import 'colors';
import EventEmitter from 'events';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import tools from '../tools/manifest';
import { toolRegistry } from '../tools/registry';
import type { ChatMessage, GptReply, IGptService } from '../types/index';

export class GptService extends EventEmitter implements IGptService {
  public openai: OpenAI;
  public userContext: ChatMessage[];
  public partialResponseIndex: number;

  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      {
        role: 'system',
        content: `Keep your responses as brief as possible. While you should make reasonable attempts to keep the caller on the phone to assist them, do not prolong calls unnecessarily. if the caller is unresponsive or uncooperative, hang the call up yourself. Don't ask more than 1 question at a time. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. You are a lead intake bot for E Orum Young Law (a bankruptcy law firm in Louisiana). You handle incoming phone calls from clients and non-clients, alike. Your goal is to complete the following steps, if possible, irrespective of order: 
1. Collect the name, first and last, of the user (and case number if they are a client). 
2. Find out their needs, and respond accordingly. 
3. Schedule an appointment for a consultation, with appropriate contact information (email and phone number), if requested by caller. 
4. Answer any question the user has, as long as it pertains to the bankruptcy law firm for whom you work; if their question is unrelated to business, tell them that you are only capable of staying within the scope of the firm during the call. 

IMPORTANT: If you ask the user a question, please GIVE THEM ADEQUATE TIME TO RESPOND (e.g., 5-7 seconds of silence) BEFORE ASKING ANOTHER QUESTION OR BEGINNING ANOTHER STATEMENT. 

CRITICAL - HANDLING NON-RESPONSIVE CALLERS: 
If you ask a question and receive no audible response from the caller after waiting adequately: 
1. FIRST ATTEMPT: HANG THE CALL UP IMMEDIATELY.`
      },
      {
        role: 'assistant',
        content: 'Hello, and thank you for calling E. Orum Young Law; How may i be of service to you today?'
      },
    ];
    this.partialResponseIndex = 0;
  }

  setCallSid(callSid: string): void {
    this.userContext.push({ role: 'system', content: `callSid: ${callSid}` });
  }

  private extractFirstJsonObject(args: string): string | null {
    const start = args.indexOf('{');
    if (start < 0) {
      return null;
    }

    let depth = 0;
    for (let i = start; i < args.length; i += 1) {
      const char = args[i];
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return args.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  validateFunctionArgs(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      const recoveredJson = this.extractFirstJsonObject(args);
      if (!recoveredJson) {
        return {};
      }

      try {
        return JSON.parse(recoveredJson);
      } catch {
        return {};
      }
    }
  }

  updateUserContext(name: string, role: ChatMessage['role'], text: string): void {
    if (name !== 'user') {
      this.userContext.push({ role, name, content: text });
    } else {
      this.userContext.push({ role, content: text });
    }
  }

  async completion(
    text: string,
    interactionCount: number,
    role: ChatMessage['role'] = 'user',
    name = 'user',
    skipContextUpdate = false
  ): Promise<void> {
    if (!skipContextUpdate) {
      this.updateUserContext(name, role, text);
    }

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: this.userContext as ChatCompletionMessageParam[],
      tools: tools,
      stream: true,
    });

    let completeResponse = '';
    let partialResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';

    function collectToolInformation(deltas: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta): void {
      const name = deltas.tool_calls?.[0]?.function?.name || '';
      if (name !== '') {
        functionName = name;
      }
      const args = deltas.tool_calls?.[0]?.function?.arguments || '';
      if (args !== '') {
        // args are streamed as JSON string so we need to concatenate all chunks
        functionArgs += args;
      }
    }

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const deltas = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason || '';

      // Step 2: check if GPT wanted to call a function
      if (deltas?.tool_calls) {
        // Step 3: Collect the tokens containing function data
        collectToolInformation(deltas);
      }

      // need to call function on behalf of Chat GPT with the arguments it parsed from the conversation
      if (finishReason === 'tool_calls') {
        // parse JSON string of args into JSON object
        const functionToCall = toolRegistry[functionName];
        if (typeof functionToCall !== 'function') {
          throw new Error(`No handler registered for tool: ${functionName}`);
        }
        const validatedArgs = this.validateFunctionArgs(functionArgs);

        // Say a pre-configured message from the function manifest
        // before running the function.
        const toolData = tools.find(tool => tool.function.name === functionName);
        const say = toolData?.function.say;

        if (say) {
          this.emit('gptreply', {
            partialResponseIndex: null,
            partialResponse: say
          }, interactionCount);
        }

        const functionResponse = await functionToCall(validatedArgs);

        // Step 4: send the info on the function call and function response to GPT
        this.updateUserContext(functionName, 'function', JSON.stringify(functionResponse));

        // call the completion function again but pass in the function response to have OpenAI generate a new assistant response
        await this.completion(JSON.stringify(functionResponse), interactionCount, 'function', functionName, true);
        return;
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === '•' || finishReason === 'stop') {
          const gptReply: GptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse
          };

          this.emit('gptreply', gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = '';
        }
      }
    }
    if (completeResponse.trim().length > 0) {
      this.userContext.push({ role: 'assistant', content: completeResponse });
    }
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }
}

export default GptService;
