import { CoreHandler } from "./coreHandler";
import {
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Client,
} from "discord.js";
import * as clc from "cli-color";
import * as errs from "./Errors";
import {
    CommandObject,
    HandlerFlags,
    LoaderOptions,
    RunFlags,
} from "./interfaces";
import { deprecated, setupCollector } from "../funcs";

/**
 * Helper function to just attach [DEV] to a command that is of developer.
 * @param name
 * @param isDev
 * @returns
 */
function attachDev(name: string, isDev: boolean) {
    const str = "[DEV] ";
    return isDev ? str + name : name;
}

/**
 * @class
 * Command Handler which loads, edits and deletes slash commands for you.
 */
export class CommandHandler extends CoreHandler {
    client: Client;
    commandPath: string;
    options: LoaderOptions = {
        loadedNoChanges: "NAME was loaded. No changes were made.",
        loaded: "NAME has been registered successfully.",
        edited: "NAME has been edited.",
        deleted: "NAME has been deleted.",
        skipped: "NAME was skipped. (Command deleted or set to delete.)",
    };
    runFlags: RunFlags = {
        testGuildId: undefined,
        devs: [],
        onlyDev: "Only developers are allowed to run this command.",
        userNoPerms: "Not enough permissions.",
        botNoPerms: "I don't have enough permissions.",
    };
    flags: HandlerFlags = {
        debugger: false,
        disableLogs: false,
        production: false,
        refreshApplicationCommands: false,
        logToFile: false,
    };

    /**
     *
     * @param client Discord.js Client
     * @param path Path to Slash Commands
     * @param runFlags Command Reader Options
     * @param loaderOptions Command Loader Options
     * @param handlerFlags Injection Options.
     */
    constructor(
        client: Client,
        path: string,
        runFlags?: RunFlags,
        loaderOptions?: LoaderOptions,
        handlerFlags?: HandlerFlags
    ) {
        super(client, handlerFlags?.debugger, handlerFlags.logToFile);

        this.flags = {
            debugger: handlerFlags?.debugger || this.flags.debugger,
            disableLogs: handlerFlags?.disableLogs || this.flags.disableLogs,
            production: handlerFlags?.production || this.flags.production,
            logToFile: handlerFlags?.logToFile || this.flags.logToFile,
            refreshApplicationCommands:
                handlerFlags?.refreshApplicationCommands ||
                this.flags.refreshApplicationCommands,
        };

        this.commandPath = path;

        this.options = {
            loadedNoChanges: clc.magenta.bold(
                loaderOptions?.loadedNoChanges || this.options.loadedNoChanges
            ),
            loaded: clc.green.bold(
                loaderOptions?.loaded || this.options.loaded
            ),
            edited: clc.yellow.bold(
                loaderOptions?.edited || this.options.edited
            ),
            deleted: clc.red.bold(
                loaderOptions?.deleted || this.options.deleted
            ),
            skipped: clc.cyan.bold(
                loaderOptions?.skipped || this.options.skipped
            ),
        };

        this.runFlags = {
            testGuildId: runFlags?.testGuildId || undefined,
            devs: runFlags?.devs || [],
            onlyDev: runFlags?.onlyDev || this.runFlags.onlyDev,
            userNoPerms: runFlags?.userNoPerms || this.runFlags.userNoPerms,
            botNoPerms: runFlags?.botNoPerms || this.runFlags.botNoPerms,
        };
    }

    /**
     * Register Slash Commands
     * @param logNoChanges Log when loading a command and no changes are made
     * @param serverId Server Id, Makes loaded commands guild wide.
     */
    async registerCommands(logNoChanges?: boolean, serverId?: string) {
        if (this.flags.debugger) this.debug.topMsg("registerCommands()");
        logNoChanges = logNoChanges !== undefined ? logNoChanges : true;
        try {
            const localCommands = this.getLocalCommands(this.commandPath);
            const applicationCommands = await this.getApplicationCommands(
                this.client,
                serverId
            );

            if (this.flags.refreshApplicationCommands) {
                let count = 0;
                applicationCommands.cache.forEach((v) => {
                    if (v.type !== ApplicationCommandType.ChatInput) return;
                    if (this.flags.debugger) this.debug.refresh.sMsg(v.name);
                    applicationCommands.delete(v.id);
                    count++;
                });
                if (this.flags.debugger) this.debug.refresh.lMsg();

                console.log(
                    clc.yellow.underline.italic(
                        `${count} application commands (Slash Only) have been deleted.`
                    )
                );
            }

            for (const localCommand of localCommands) {
                if (
                    !localCommand.name ||
                    !localCommand.description ||
                    !localCommand.callback
                )
                    throw new errs.LoaderError(
                        `Command $PATH$ does not export required properties: name, description or callback`,
                        localCommand.filePath
                    );

                let { name, filePath, isOld, data, isDev } = localCommand;

                if (localCommand.isDev && this.flags.production) {
                    const existingCommand =
                        await applicationCommands.cache.find(
                            (cmd) => cmd.name === name
                        );
                    if (existingCommand) {
                        applicationCommands.delete(existingCommand.id);
                    }
                    continue;
                }

                let noChanges = true;

                try {
                    const existingCommand =
                        await applicationCommands.cache.find(
                            (cmd) => cmd.name === name
                        );

                    if (existingCommand) {
                        if (localCommand.deleted) {
                            // Delete Command
                            await applicationCommands.delete(
                                existingCommand.id
                            );
                            noChanges = false;
                            if (!this.flags.disableLogs)
                                console.log(
                                    this.options.deleted.replace(
                                        "NAME",
                                        attachDev(name, isDev)
                                    )
                                );
                            continue;
                        }

                        if (
                            this.areCommandsDifferent(
                                existingCommand,
                                localCommand
                            )
                        ) {
                            // Command was edited.
                            await applicationCommands.edit(
                                existingCommand.id,
                                // @ts-ignore
                                data
                            );
                            noChanges = false;

                            if (!this.flags.disableLogs)
                                console.log(
                                    deprecated(
                                        this.options.edited.replace(
                                            "NAME",
                                            attachDev(name, isDev)
                                        ),
                                        isOld
                                    )
                                );
                        }
                    } else {
                        if (localCommand.deleted) {
                            // Command was previously deleted
                            noChanges = false;
                            if (!this.flags.disableLogs)
                                console.log(
                                    deprecated(
                                        this.options.skipped.replace(
                                            "NAME",
                                            attachDev(name, isDev)
                                        ),
                                        isOld
                                    )
                                );
                            continue;
                        }

                        // Create new command.
                        await applicationCommands.create(data);
                        noChanges = false;

                        if (!this.flags.disableLogs)
                            console.log(
                                deprecated(
                                    this.options.loaded.replace(
                                        "NAME",
                                        attachDev(name, isDev)
                                    ),
                                    isOld
                                )
                            );
                    }
                } catch (err) {
                    throw new errs.LoaderError(
                        `Command $NAME$ from $PATH$:` + err,
                        filePath,
                        name
                    );
                }

                if (logNoChanges && noChanges == true) {
                    if (!this.flags.disableLogs)
                        console.log(
                            deprecated(
                                this.options.loadedNoChanges.replace(
                                    "NAME",
                                    attachDev(name, isDev)
                                ),
                                isOld
                            )
                        );
                }
            }
        } catch (error) {
            let msg = "Loading commands failed with the error: ";
            let Lerr =
                error instanceof errs.LoaderError
                    ? `${clc.bold("(" + error.name + ")")} ` +
                      msg +
                      error.message
                    : msg;

            throw new Error(Lerr);
        }
    }

    /**
     * Handle Slash Commands
     * @param middleWare Functions to be run before running a command.
     */
    async handleCommands(
        ...middleWare: ((
            commandObject: CommandObject,
            interaction?: ChatInputCommandInteraction
        ) => number | Promise<number>)[]
    ) {
        if (this.flags.debugger) this.debug.topMsg("handleCommands()");
        this.client.on(
            "interactionCreate",
            async (interaction: ChatInputCommandInteraction) => {
                if (!interaction.isChatInputCommand()) return;

                if (this.flags.debugger)
                    this.debug.common(
                        "'" + interaction.commandName + "' has been called."
                    );

                const localCommands = this.getLocalCommands(this.commandPath);

                const commandObject: CommandObject = localCommands.find(
                    (cmd: CommandObject) => cmd.name === interaction.commandName
                );

                try {
                    if (!commandObject) return;

                    if (commandObject.devOnly) {
                        if (!this.runFlags.devs.includes(interaction.user.id)) {
                            if (this.flags.debugger)
                                this.debug.commonBlue(
                                    "\tUser tried running " +
                                        interaction.commandName +
                                        " which is a dev command."
                                );
                            interaction.reply({
                                content: this.runFlags.onlyDev,
                                ephemeral: true,
                            });
                            return;
                        }
                    }

                    if (commandObject.permissionsRequired?.length) {
                        for (const permission of commandObject.permissionsRequired) {
                            if (
                                //@ts-ignore
                                !interaction.member.permissions.has(permission)
                            ) {
                                if (this.flags.debugger)
                                    this.debug.commonBlue(
                                        "\tUser did not have enough permissions to run " +
                                            interaction.commandName
                                    );
                                interaction.reply({
                                    content: this.runFlags.userNoPerms,
                                    ephemeral: true,
                                });
                                return;
                            }
                        }
                    }

                    if (commandObject.botPermissions?.length) {
                        for (const permission of commandObject.botPermissions) {
                            const bot = interaction.guild.members.me;
                            //@ts-ignore
                            if (!bot.permissions.has(permission)) {
                                if (this.flags.debugger)
                                    this.debug.commonBlue(
                                        "\tBot did not have the required permissions to run " +
                                            interaction.commandName
                                    );
                                interaction.reply({
                                    content: this.runFlags.botNoPerms,
                                    ephemeral: true,
                                });
                                return;
                            }
                        }
                    }

                    if (this.flags.debugger)
                        this.debug.common("\tMiddlewares Called:");

                    for (const fn of middleWare) {
                        let result = await fn(commandObject, interaction);
                        if (this.flags.debugger) {
                            const arr = fn.toString().split(" ");
                            // Means the function has (function a(){}) syntax, otherwise it's (()=>{}) syntax
                            const labeled = arr[0] == "function" ? true : false;
                            this.debug.common(
                                "\t\t" +
                                    clc.bold.italic.red("fn") +
                                    " " +
                                    clc.bold.magenta(
                                        fn.toString().split("{")[0] +
                                            (labeled ? "=> " + result : result)
                                    )
                            );
                        }
                        if (result == 1) return; // test condition is true
                    }

                    if (this.flags.debugger)
                        this.debug.common(
                            "Middlewares called, Callback to be called."
                        );

                    await commandObject.callback(this.client, interaction);

                    if (
                        commandObject.interactions.button &&
                        Object.keys(commandObject.interactions.button).length !=
                            0
                    ) {
                        for (const [key, value] of Object.entries(
                            commandObject.interactions.button
                        )) {
                            if (
                                value.timeout == 0 ||
                                value.timeout == undefined
                            )
                                continue;
                            await setupCollector(
                                this.client,
                                interaction,
                                value
                            );
                        }
                    }

                    if (
                        commandObject.interactions.selectMenu &&
                        Object.keys(commandObject.interactions.selectMenu)
                            .length != 0
                    ) {
                        for (const [key, value] of Object.entries(
                            commandObject.interactions.selectMenu
                        )) {
                            if (
                                value.timeout == 0 ||
                                value.timeout == undefined
                            )
                                continue;
                            await setupCollector(
                                this.client,
                                interaction,
                                value
                            );
                        }
                    }
                } catch (error) {
                    let err = new errs.HandlerError(
                        `Failed to run command $NAME$ \n\n` + error,
                        commandObject.filePath,
                        commandObject.name
                    );
                    console.error(error);
                    throw err;
                }
            }
        );
    }
}
