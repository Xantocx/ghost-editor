import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import { Block } from "@prisma/client";
import { BlockProxy } from "../../database/proxy-types";
import { prismaClient } from "../../database/client";
import log from "electron-log"

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI = new OpenAIApi(configuration);
const MODEL  = "gpt-3.5-turbo"

export default class CodeAI {

    private static readonly temperature:      number                   = 0
    private static readonly maxTokens:        number                   = 256
    private static readonly stop:             string | string[] | null = null
    private static readonly topP:             number                   = 1
    private static readonly frequencyPenalty: number                   = 0
    private static readonly presencePenalty:  number                   = 0

    public static async errorSuggestion(code: string, errorMessage: string): Promise<string | null> {
        
        const messages: ChatCompletionRequestMessage[] = [
            { role: "system", content: "You are a coding assistant helping with creative coding using P5JS. Specifically, you should provide support for debugging code." },
            { role: "user",   content: `The following code results in this error message: "${errorMessage}". How could I fix that?\n${code}` }
        ]

        const chatCompletion = await OPENAI.createChatCompletion({
            model:             MODEL,
            messages:          messages,
            temperature:       this.temperature,
            max_tokens:        this.maxTokens,
            stop:              this.stop,
            top_p:             this.topP,
            frequency_penalty: this.frequencyPenalty,
            presence_penalty:  this.presencePenalty
        });

        try {
            return chatCompletion.data.choices[0].message.content
        } catch {
            log.warn("Failed to generate error suggestion!")
            return null
        }
    }

    public readonly root:  BlockProxy
    public readonly block: BlockProxy

    private readonly versionNameHistory: ChatCompletionRequestMessage[]

    private readonly temperature:      number                   = CodeAI.temperature
    private readonly maxTokens:        number                   = CodeAI.maxTokens
    private readonly stop:             string | string[] | null = CodeAI.stop
    private readonly topP:             number                   = CodeAI.topP
    private readonly frequencyPenalty: number                   = CodeAI.frequencyPenalty
    private readonly presencePenalty:  number                   = CodeAI.presencePenalty

    public static async create(block: BlockProxy, blockData: Block): Promise<CodeAI> {
        const root               = await block.getFileRoot()
        const versionNameHistory = JSON.parse(blockData.aiVersionNameHistory)
        return new CodeAI(root, block, versionNameHistory)
    }

    private constructor(root: BlockProxy, block: BlockProxy, versionNameHistory: ChatCompletionRequestMessage[]) {
        this.root               = root
        this.block              = block
        this.versionNameHistory = versionNameHistory
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
            // NOTE: This is not always the same format, so sometimes, I might end up with no title or description... AI and stuff... ugh.
            const response = chatCompletion.data.choices[0].message

            const lines = response.content.split("\n")
            versionInfo.name        = lines[0].replace('Name:', '').replace(new RegExp('"', "g"), '').trim()
            versionInfo.description = lines[2].replace('Description: ', '')

            this.versionNameHistory.push(requestMessage, response)

            await prismaClient.block.update({
                where: { id: this.block.id },
                data:  {
                    aiVersionNameHistory: JSON.stringify(this.versionNameHistory)
                }
            })
        } catch {
            log.warn("Failed to generate version info!")
        }

        return versionInfo
    }
}