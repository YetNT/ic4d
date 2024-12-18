import {
    Client,
    AnySelectMenuInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    ChatInputCommandInteraction,
} from "discord.js";
import { InteractionTypeStrings } from "./builders";

export type InteractionTypeStringsMap<U extends string> = U extends "modal"
    ? ModalSubmitInteraction
    : U extends "selectMenu"
    ? AnySelectMenuInteraction
    : U extends "button"
    ? ButtonInteraction
    : never;

/**
 * @class
 * Represents an interaction object. (DOES NOT INCLUDE CONTEXT MENUS)
 */
export class InteractionBuilder {
    private defaultTimeout: number = 15000;
    /**
     * Function run when this interaction is called.
     * @param interaction Interaction
     * @param client Client
     */
    callback: (
        interaction: InteractionTypeStringsMap<this["type"]>,
        client?: Client,
        variables?: { [key: string]: any }
    ) => void | Promise<void>;
    /**
     * The interaction's custom identifier
     */
    customId: string;
    /**
     * Type of interaction. Either "selectMenu", "modal" or "button"
     */
    type: InteractionTypeStrings;
    /**
     * Set the only author status of the button.
     */
    onlyAuthor: boolean;
    /**
     * Path to which this interaction is located
     */
    filePath: string;
    /**
     * Time out (Select menu and Button) after given MILLISECONDS
     */
    timeout?: number;
    /**
     * Function to run when interaction times out. If this is set, timeoutMsg property is ignored.
     */
    onTimeout?: (
        interaction: ChatInputCommandInteraction,
        client?: Client,
        variables?: { [key: string]: any }
    ) => void | Promise<void>;
    /**
     * Build the actual interaction
     */
    constructor() {
        this.customId = undefined;
        this.type = undefined;
        this.callback = undefined;
        this.onlyAuthor = false;
        this.timeout = 0;
        this.onTimeout = undefined;

        this.filePath = __dirname;
    }

    /**
     * Set the custom ID of the interaction.
     * @param id The Custom ID of the interaction.
     */
    setCustomId(customId: string): InteractionBuilder {
        this.customId = customId;
        return this;
    }

    /**
     * Set the type of the interaction.
     * @param type Type of interaction, Either "selectMenu", "modal" or "button"
     */
    setType(type: InteractionTypeStrings): InteractionBuilder {
        this.type = type;
        return this;
    }

    /**
     * Callback function to be called when the interaction is called.
     * @param f Function to be called, taking the interaction as argument and client is an optional
     */
    setCallback(
        fn: (
            interaction: InteractionTypeStringsMap<this["type"]>,
            client?: Client,
            variables?: { [key: string]: any }
        ) => void | Promise<void>
    ): InteractionBuilder {
        this.callback = fn;
        return this;
    }

    /**
     * Set the interaction to only accept the author's input.
     * @param bool If true, the interaction will only accept the author's input.
     */
    setOnlyAuthor(bool: boolean): InteractionBuilder {
        this.onlyAuthor = bool;
        return this;
    }

    /**
     * Sets the interaction to have a timeout.
     * @param func Function to call when the interaction timeout expires.
     * @param timeout How long to wait for the interaction timeout. (ms)
     */
    setTimeout(
        fn: (
            interaction: ChatInputCommandInteraction,
            client?: Client,
            variables?: { [key: string]: any }
        ) => void | Promise<void>,
        timeout?: number
    ): InteractionBuilder {
        this.onTimeout = fn;
        this.timeout = timeout != undefined ? timeout : this.defaultTimeout;
        return this;
    }
}
