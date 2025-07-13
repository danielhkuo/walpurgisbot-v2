// src/services/funService.ts
import { Client, Message } from 'discord.js';

const RESPONSES = {
    CRINGE: 'https://tenor.com/view/cringe-comp-cringe-shrek-shrek-cringe-compilation-snap-gif-11981937',
    MASSIVE: 'https://tenor.com/view/ninja-any-haircut-recommendations-low-taper-fade-you-know-what-else-is-massive-gif-3708438262570242561',
    ERM: 'https://tenor.com/view/jungwon-jungwon-glasses-jungwon-um-ackshually-jungwon-um-actually-gif-16607372845996584568',
    RIPBOZO: 'https://tenor.com/view/rip-bozo-gif-22294771',
    LEBRON: "Boy oh boy where do I even begin. Lebron... honey, my pookie bear. " +
            "I have loved you ever since I first laid eyes on you. The way you drive into the paint and strike fear into your enemies' eyes. " +
            "Your silky smooth touch around the rim, and that gorgeous jumpshot. I would do anything for you. I wish it were possible to freeze time " +
            "so I would never have to watch you retire. You had a rough childhood, but you never gave up hope. You are even amazing off the court, you're a great husband and father, sometimes I even call you dad. " +
            "I forever dread and weep, thinking of the day you will one day retire. I would sacrifice my own life if it were the only thing that could put a smile on your beautiful face. " +
            "You have given me so much joy, and heartbreak over the years. I remember when you first left Cleveland and it's like my heart got broken into a million pieces. " +
            "But a tear still fell from my right eye when I watched you win your first ring in Miami, because deep down, my glorious king deserved it. I just wanted you to return home. " +
            "Then alas, you did, my sweet baby boy came home and I rejoiced. 2015 was a hard year for us baby, but in 2016 you made history happen. You came back from 3-1 and I couldn't believe it. " +
            "I was crying, bawling even, and I heard my glorious king exclaim these words, \"CLEVELAND, THIS IS FOR YOU!\" Not only have you changed the game of basketball and the world forever, but you've eternally changed my world. " +
            "And now you're getting older, but still the goat, my goat. I love you pookie bear, my glorious king, LeBron James.☺️♥️🫶🏻",
};

/**
 * A service for fun, whimsical features like responding to memes.
 */
export class FunService {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Checks a message for trigger words and sends a response.
     * @param message The message to check.
     */
    public async handleMessage(message: Message): Promise<void> {
        const content = message.content;
        let response: string | undefined;

        if (/\bcringe\b/i.test(content)) {
            this.client.logger.debug("Detected 'cringe'. Sending meme.");
            response = RESPONSES.CRINGE;
        } else if (/\bmassive\b/i.test(content)) {
            this.client.logger.debug("Detected 'massive'. Sending meme.");
            response = RESPONSES.MASSIVE;
        } else if (/\b[eE]+[rR]+[mM]+\b/.test(content)) { // Matches python logic (e.g. Erm, ERM, eerrrmm)
            this.client.logger.debug("Detected 'erm'. Sending meme.");
            response = RESPONSES.ERM;
        } else if (/\brip\s*bozo\b/i.test(content)) {
            this.client.logger.debug("Detected 'rip bozo'. Sending meme.");
            response = RESPONSES.RIPBOZO;
        } else if (/\blebron\b/i.test(content)) {
            this.client.logger.debug("Detected 'lebron'. Sending heartfelt message.");
            response = RESPONSES.LEBRON;
        }

        if (response) {
            try {
                // Type guard to ensure channel supports sending messages
                if (message.channel && 'send' in message.channel) {
                    await message.channel.send(response);
                }
            } catch (error) {
                this.client.logger.error({ err: error, channelId: message.channel.id }, 'Failed to send fun response.');
            }
        }
    }
}