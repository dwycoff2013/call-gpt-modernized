"""Zoho CRM MCP server with a curated OpenAPI surface."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fastmcp import FastMCP
from fastmcp.contrib.openapi import OpenAPIServer

TOKEN_BUFFER_SECONDS = 60
DEFAULT_ACCOUNTS_URL = "https://accounts.zoho.com"
DEFAULT_API_DOMAIN = "https://www.zohoapis.com"


class ZohoAuth:
    def __init__(self) -> None:
        self.client_id = self._required("ZOHO_CLIENT_ID")
        self.client_secret = self._required("ZOHO_CLIENT_SECRET")
        self.refresh_token = self._required("ZOHO_REFRESH_TOKEN")
        self.accounts_url = os.getenv("ZOHO_ACCOUNTS_URL", DEFAULT_ACCOUNTS_URL).rstrip("/")
        self.access_token: Optional[str] = None
        self.expires_at = 0.0

    def _required(self, key: str) -> str:
        value = os.getenv(key, "").strip()
        if not value:
            raise RuntimeError(f"Missing required environment variable: {key}")
        return value

    def _token_valid(self) -> bool:
        if not self.access_token:
            return False
        return time.time() + TOKEN_BUFFER_SECONDS < self.expires_at

    def _refresh(self) -> str:
        response = requests.post(
            f"{self.accounts_url}/oauth/v2/token",
            params={
                "refresh_token": self.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise RuntimeError("Zoho token response did not include access_token")

        expires_in = payload.get("expires_in", 3600)
        self.access_token = token
        self.expires_at = time.time() + float(expires_in)
        return token

    def get_access_token(self, force: bool = False) -> str:
        if not force and self._token_valid():
            return self.access_token or ""
        return self._refresh()

    def request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        token = self.get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
        }

        response = requests.request(
            method,
            url,
            params=params,
            json=json_body,
            headers=headers,
            timeout=30,
        )

        if response.status_code == 401:
            refreshed = self.get_access_token(force=True)
            headers["Authorization"] = f"Zoho-oauthtoken {refreshed}"
            response = requests.request(
                method,
                url,
                params=params,
                json=json_body,
                headers=headers,
                timeout=30,
            )

        if response.status_code == 204:
            return {}

        payload = response.json() if response.text else {}
        if response.status_code >= 400:
            raise RuntimeError(f"Zoho API request failed ({response.status_code}): {payload}")
        return payload


class ZohoCrmApi:
    def __init__(self, auth: ZohoAuth) -> None:
        self.auth = auth
        self.api_domain = os.getenv("ZOHO_API_DOMAIN", DEFAULT_API_DOMAIN).rstrip("/")
        self.base_url = f"{self.api_domain}/crm/v2"

    def find_lead_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        try:
            payload = self.auth.request("GET", f"{self.base_url}/Leads/search", params={"email": email})
            data = payload.get("data", [])
            return data[0] if data else None
        except RuntimeError as error:
            if "NO_RECORDS_FOUND" in str(error):
                return None
            raise

    def create_lead(self, lead_details: Dict[str, Any]) -> str:
        payload = {
            "data": [
                {
                    "First_Name": lead_details["first_name"],
                    "Last_Name": lead_details["last_name"],
                    "Email": lead_details["email"],
                    "Phone": lead_details["phone"],
                    "Lead_Source": "Phone Call Intake",
                }
            ]
        }
        response = self.auth.request("POST", f"{self.base_url}/Leads", json_body=payload)
        result = (response.get("data") or [{}])[0]
        if result.get("status") != "success":
            raise RuntimeError(f"Error creating CRM lead: {result}")
        return str(result["details"]["id"])

    def create_event(self, event_details: Dict[str, Any]) -> str:
        event_payload: Dict[str, Any] = {
            "Event_Title": event_details["event_title"],
            "Start_DateTime": event_details["start_datetime"],
            "End_DateTime": event_details["end_datetime"],
        }

        if event_details.get("appointment_type"):
            event_payload["Resource_Id"] = event_details["appointment_type"]

        if event_details.get("staff_member"):
            event_payload["Staff_Id"] = event_details["staff_member"]

        if event_details.get("lead_id"):
            event_payload["$se_module"] = "Leads"
            event_payload["What_Id"] = {"id": event_details["lead_id"]}

        response = self.auth.request("POST", f"{self.base_url}/Events", json_body={"data": [event_payload]})
        result = (response.get("data") or [{}])[0]
        if result.get("status") != "success":
            raise RuntimeError(f"Error creating CRM event: {result}")
        return str(result["details"]["id"])

    def get_events_by_time_range(self, start_datetime: str, end_datetime: str) -> List[Dict[str, str]]:
        query = (
            "select id from Events "
            f"where (Start_DateTime <= '{end_datetime}' and End_DateTime >= '{start_datetime}')"
        )
        response = self.auth.request("POST", f"{self.base_url}/coql", json_body={"select_query": query})
        rows = response.get("data") or []
        return [{"id": str(item["id"])} for item in rows if isinstance(item, dict) and item.get("id")]


def create_server() -> FastMCP:
    auth = ZohoAuth()
    api = ZohoCrmApi(auth)

    mcp = FastMCP("zoho-crm-curated")

    curated_spec_path = Path(__file__).resolve().parent / "specs" / "zoho-crm-curated.json"
    with curated_spec_path.open("r", encoding="utf-8") as spec_file:
        spec = json.load(spec_file)

    openapi_server = OpenAPIServer(spec=spec)
    mcp.mount(openapi_server, prefix="curated-openapi")

    @mcp.tool(name="findLeadByEmail")
    def find_lead_by_email(email: str) -> Dict[str, Any]:
        return {"lead": api.find_lead_by_email(email)}

    @mcp.tool(name="createLead")
    def create_lead(leadDetails: Dict[str, Any]) -> Dict[str, str]:
        return {"id": api.create_lead(leadDetails)}

    @mcp.tool(name="createEvent")
    def create_event(eventDetails: Dict[str, Any]) -> Dict[str, str]:
        return {"id": api.create_event(eventDetails)}

    @mcp.tool(name="getEventsByTimeRange")
    def get_events_by_time_range(startDateTime: str, endDateTime: str) -> Dict[str, List[Dict[str, str]]]:
        return {"events": api.get_events_by_time_range(startDateTime, endDateTime)}

    return mcp


if __name__ == "__main__":
    create_server().run(transport="stdio")
