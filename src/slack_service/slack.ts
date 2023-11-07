import { WebClient } from "@slack/web-api";

export class SlackNotifier {
  private webhookUrl: string;

  constructor() {
    if (process.env.SLACK_WEB_HOOK_URL) {
      this.webhookUrl = process.env.SLACK_WEB_HOOK_URL!;
    } else {
      throw new Error("SLACK_WEB_HOOK_URL is not defined");
    }
  }

  async send_message(text: string): Promise<void> {
    console.log("Sending error message to slack");
    console.log(text);
    const payload = {
      text: text,
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message. Status: ${response.status}`);
    }
  }
}
