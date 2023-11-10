import { WebClient } from "@slack/web-api";

export interface SlackBlockkitMessage {
  blocks: SlackBlock[];
}

export interface SlackBlock {
  type: "section" | "divider" | "image" | "actions" | "context" | "header";
  text?: SlackBlockText;
  fields?: SlackBlockText[];
}

export interface SlackBlockText {
  type: "mrkdwn" | "plain_text";
  text: string;
}

export class SlackNotifier {
  private webhookUrl: string;

  constructor() {
    if (process.env.SLACK_WEB_HOOK_TOKEN) {
      this.webhookUrl = `https://hooks.slack.com/services/${process.env.SLACK_WEB_HOOK_TOKEN}`;
    } else {
      throw new Error("SLACK_WEB_HOOK_URL is not defined");
    }
  }

  async send_message(message: SlackBlockkitMessage): Promise<void> {
    console.log("Sending error message to slack");
    console.log(message);

    const payload = JSON.stringify(message);

    // const payload = {
    //   text: text,
    // };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    response
      .text()
      .then((data) => console.log("Slack submission response:", data));

    if (!response.ok) {
      throw new Error(`Failed to send message. Status: ${response.status}`);
    }
  }
}
