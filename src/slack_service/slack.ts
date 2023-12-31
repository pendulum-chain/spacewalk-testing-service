import { KnownBlock, Block } from "@slack/types";

export type SlackBlock = KnownBlock | Block;

export interface SlackBlockkitMessage {
  blocks?: SlackBlock[];
}

export class SlackNotifier {
  private webhookUrl: string;

  constructor() {
    if (process.env.SLACK_WEB_HOOK_TOKEN) {
      this.webhookUrl = `https://hooks.slack.com/services/${process.env.SLACK_WEB_HOOK_TOKEN}`;
    } else {
      throw new Error("SLACK_WEB_HOOK_TOKEN is not defined");
    }
  }

  async sendMessage(message: SlackBlockkitMessage): Promise<void> {
    const payload = JSON.stringify(message);

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Failed to send message. Status: ${response.status}`);
    }
  }
}
