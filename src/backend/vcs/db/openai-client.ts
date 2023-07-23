import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import { BlockProxy } from "./types";

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI = new OpenAIApi(configuration);
const MODEL  = "gpt-3.5-turbo"

export default class CodeAI {

    public readonly root:  BlockProxy
    public readonly block: BlockProxy

    private readonly versionNameHistory: ChatCompletionRequestMessage[] = []

    private readonly temperature:      number                   = 0
    private readonly maxTokens:        number                   = 256
    private readonly stop:             string | string[] | null = null
    private readonly topP:             number                   = 1
    private readonly frequencyPenalty: number                   = 0
    private readonly presencePenalty:  number                   = 0

    public static async create(block: BlockProxy): Promise<CodeAI> {
        const root = await block.getFileRoot()
        return new CodeAI(root, block)
    }

    private constructor(root: BlockProxy, block: BlockProxy) {
        this.root  = root
        this.block = block
    }

    private async getCompleteCode(): Promise<string> {
        return await this.root.getText([this.block])
    }

    public async generateVersionInfo(versionCode: string): Promise<{ name: string, description: string }> {
        const systemMessage: ChatCompletionRequestMessage = {
            role:    "system",
            content: `You are a coding assistant helping with creative coding using P5JS. Consider the following code for all requests:\n${await this.getCompleteCode()}`
        }

        const requestMessage: ChatCompletionRequestMessage = {
            role:    "user",
            content: `Provide a name and description that allows to quickly grasp the unique impact of this code segment. Avoid textual references to previous code snippets.\n${versionCode}`
        }

        console.log("PERFORMING OPENAI QUERY!")
        const chatCompletion = await OPENAI.createChatCompletion({
            model:             MODEL,
            messages:          [systemMessage].concat(this.versionNameHistory, requestMessage),
            temperature:       this.temperature,
            max_tokens:        this.maxTokens,
            stop:              this.stop,
            top_p:             this.topP,
            frequency_penalty: this.frequencyPenalty,
            presence_penalty:  this.presencePenalty
        });

        const versionInfo = { name: `Tag ${this.block.tags.length + 1}`, description: "No description available." }
        
        try {
            const response = chatCompletion.data.choices[0].message

            const lines = response.content.split("\n")
            versionInfo.name        = lines[0].replace('Name:', '').replace(new RegExp('"', "g"), '').trim()
            versionInfo.description = lines[2].replace('Description: ', '')

            this.versionNameHistory.push(requestMessage, response)
        } catch {
            console.warn("Failed to generate version info!")
        }

        return versionInfo
    }
}