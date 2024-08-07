import {
    ContextMenuCommandInteraction,
    Client,
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord.js";

/**
 * @class
 * Represents a context menu
 */
export class ContextMenuBuilder {
    isCommand: boolean = false; // This is so that when it's read by th command handler, it's skipped. And because it's its own interaction like slash commands, the interaction handler reads it seprately.
    type: ApplicationCommandType;
    data: RESTPostAPIContextMenuApplicationCommandsJSONBody;
    name: string;
    callback: (
        interaction: ContextMenuCommandInteraction,
        client?: Client
    ) => void;
    deleted: boolean;

    /**
     * Build the actual context menu.
     * @param context Context Menu Object
     */
    constructor(context: {
        data: ContextMenuCommandBuilder;
        execute: (
            interaction: ContextMenuCommandInteraction,
            client?: Client
        ) => void;
    }) {
        this.data = context.data.toJSON();
        this.name = context.data.toJSON().name;
        this.type = context.data.toJSON().type;
        this.callback = context.execute;
    }

    /**
     * Sets the deleted property of the context menu.
     * @param deleted Boolean indicating whether the context menu is deleted.
     * @returns
     */
    setDeleted(deleted: boolean): ContextMenuBuilder {
        this.deleted = deleted;
        return this;
    }
}
