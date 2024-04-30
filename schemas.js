// Tool schemas have main group key and function name keys in the schemas dictionary
// Each main groups have their own header and field definitions dictionaries
// Descriptions are also used to render human readable listing of tools
toolSchemas = {
    "webapp": {
        "header": "",
        "definitions": {},
        "schemas": {
            "dynamic_content_management": {
                "description": "A web application server that allows real-time editing and version control of HTML, JavaScript, and CSS content. Users can add, update, delete, and revert changes in HTML elements, and update JavaScript and CSS content dynamically.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "add_element": {
                            "type": "object",
                            "description": "Add a new HTML element to the web page. The server updates all clients in real time and commits the change to version control.",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "The unique identifier for the new HTML element."
                                },
                                "content": {
                                    "type": "string",
                                    "description": "The content to be placed inside the new HTML element."
                                }
                            },
                            "additionalProperties": false
                        },
                        "update_element": {
                            "type": "object",
                            "description": "Update an existing HTML element. The server broadcasts the update and commits it to version control.",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "The unique identifier for the HTML element to update."
                                },
                                "content": {
                                    "type": "string",
                                    "description": "The new content for the HTML element."
                                }
                            },
                            "additionalProperties": false
                        },
                        "delete_element": {
                            "type": "object",
                            "description": "Delete an HTML element. The server removes the element, updates all clients, and commits the change.",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "The unique identifier for the HTML element to be deleted."
                                }
                            },
                            "additionalProperties": false
                        },
                        "update_js": {
                            "type": "object",
                            "description": "Update the JavaScript file used by the web page. The update is pushed to all clients and the change is committed to version control.",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "The new JavaScript code to be used by the web page."
                                }
                            },
                            "additionalProperties": false
                        },
                        "update_css": {
                            "type": "object",
                            "description": "Update the CSS file used by the web page. The update is broadcasted to all clients and committed to version control.",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "The new CSS styles to be applied to the web page."
                                }
                            },
                            "additionalProperties": false
                        },
                        "revert_changes": {
                            "type": "object",
                            "description": "Revert to a previous commit. This rolls back the content of the web page to the state of a specified commit hash.",
                            "properties": {
                                "commitHash": {
                                    "type": "string",
                                    "description": "The Git commit hash to which the server should revert."
                                }
                            },
                            "additionalProperties": false
                        }
                    },
                    "oneOf": [
                        { "required": ["add_element"] },
                        { "required": ["update_element"] },
                        { "required": ["delete_element"] },
                        { "required": ["update_js"] },
                        { "required": ["update_css"] },
                        { "required": ["revert_changes"] }
                    ],
                    "additionalProperties": false
                }
            }
        }

    },

    "games": {
        "header": "Simple interactive games implemented in LLM environment between user and assistant.",
        "definitions": {},
        "schemas": {

            "hangman": {
                "description": "Play a hangman game with the user. The user has seven guesses to find the word as in a regular hangman figure parts. Start the game by setting a random word in init_word argument. Be creative on setting a random word. Do NOT use the most obvious ones, like cloudy, house, fables, or horse. Then, play the game by setting each letter given by the user by the guess_letter argument. Game instance responds with the state of the game at each step. If letter guess is wrong, draw the hangman figure. When user guesses the whole word, set the guess_word argument with the given word. The game ends when the user guesses the word or runs out of guesses.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "init_word": {
                            "type": "string",
                            "description": "The word invented by assistant and to be guessed by the user. The word should be in lowercase and contain only letters. Invent the word and set init_word argument for the user to guess. Word cannot be a placeholder or anonymized string similar to ***, ???, _ _ _ etc. Do not tell word to the user!"
                        },
                        "guess_letter": {
                            "type": "string",
                            "description": "A lowercase letter guessed by the user. Set the letter as a guess_letter argument quessed by the user. Game instance returns the hangman figure parts in hangmanFigure key, if the letter is not in the word. Output the current state of the game with the ascii hangmanFigure, when available."
                        },
                        "guess_word": {
                            "type": "string",
                            "description": "A lowercase word guessed by the user. Game instance responds with the right or wrong indication. Game is over in both cases. If guess was wrong, output ascii hangmanfigure. If it was right, output 'saved from torture' ascii art."
                        }
                    },
                    "oneOf": [
                        { "required": ["init_word"] },
                        { "required": ["guess_letter"] },
                        { "required": ["guess_word"] }
                    ],
                    "additionalProperties": false
                }
            },

            "fire_water_grass": {
                "description": "A simple Pokemon inspired game variation from rock-paper-scissors where players choose between fire, water, or grass. Fire beats grass, water beats fire, and grass beats water. The game pits the player against the computer in a series of rounds, with the objective being to outguess the opponent and score points based on the results of each round. Alternatively, this can be played as rock_paper_scissors game with the same rules and arguments.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "init_game": {
                            "type": "boolean",
                            "description": "Initializes a new game, resetting scores to zero. Set to true to start a new game. Responds with a message indicating that a new game has started."
                        },
                        "player_move": {
                            "type": "string",
                            "enum": ["fire", "water", "grass"],
                            "description": "The player's choice for a single round. Valid choices are 'fire', 'water', or 'grass'. The game responds with the result of the round, the choice made by the computer, and an updated score."
                        },
                        "get_score": {
                            "type": "boolean",
                            "description": "Retrieves the current score of the game. Set to true to receive the current score. The response includes the player's score and the computer's score."
                        }
                    },
                    "oneOf": [
                        { "required": ["init_game"] },
                        { "required": ["player_move"] },
                        { "required": ["get_score"] }
                    ],
                    "additionalProperties": false
                }
            },

            "ping_pong_game": {
                "description": "A simple ping-pong game where the user must guess 'ping' or 'pong'. The game keeps track of the user's score.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "user_input": {
                            "type": "string",
                            "description": "The user must say 'ping' or 'pong'. The game keeps track of the user's score."
                        }
                    },
                    "required": ["user_input"],
                    "additionalProperties": false
                }
            },

            "number_guessing_game": {
                "description": "A classic number guessing game where the user tries to guess a secret number within a specified range and a limited number of attempts. The game provides hints such as 'too high', 'too low', or 'correct' based on the user's guesses. The game ends when the user guesses the number or runs out of attempts. The game can be initialized with a new secret number range and number of attempts, or the user can make a guess to receive feedback.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "init_game": {
                            "type": "object",
                            "description": "Initialize a new game by setting the range of the secret number and the number of guesses allowed. The game responds with a message indicating that a new game has started.",
                            "properties": {
                                "min": {
                                    "type": "integer",
                                    "description": "The minimum value of the secret number."
                                },
                                "max": {
                                    "type": "integer",
                                    "description": "The maximum value of the secret number."
                                },
                                "guesses": {
                                    "type": "integer",
                                    "description": "The number of guesses allowed to the user to find the secret number."
                                }
                            },
                            "additionalProperties": false
                        },
                        "guess_number": {
                            "type": "integer",
                            "description": "The number guessed by the user. The game responds with hints such as 'too high', 'too low', or 'correct' based on the user's guess. The game ends when the user guesses the number or runs out of guesses."
                        }
                    },
                    "oneOf": [
                        { "required": ["init_game"] },
                        { "required": ["guess_number"] }
                    ],
                    "additionalProperties": false
                }
            },
        },
    },

    "general": {
        "header": "General tools for various purposes like code execution and memory management.",
        "definitions": {},
        "schemas": {

            "nodejs_code_runner": {
                "description": "Run NodeJS code deduced from human language expressed by the user input. The code is executed in a wm subprocess to isolate it from the core system. Allowed native Node functions consist of math, type conversion, data structure, iterative, string, functional, and miscellaneous functions like print, type, isinstance, and import. You may use 'sessions' state variable to store data between requests. For a guessing game, you can store the secret number in the session state with math random function.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "NodeJS code to evaluate. Code expression is evaluated by exec Node function, which does not return the results. Thus, console.log the result. Output will go to the buffer and be handled by the program. Newlines in the code must be escaped with \\n. Always escape single quotes in literals correctly! Use non-blocking code only because user cannot interact with the code execution. For instance, readline input cannot be used in the code. You can refer to a global state object called 'session' to store data between code executions."
                        }
                    },
                    "required": ["code"],
                    "additionalProperties": false
                }
            },

            "runtime_memory_storage": {
                "description": "Handles runtime memory operations such as set, get, and delete.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "description": "Type of operation to perform.",
                            "enum": ["set", "get", "del"]
                        },
                        "key": {
                            "type": "string",
                            "description": "Data property key."
                        },
                        "value": {
                            "type": "mixed",
                            "description": "Data property value, required for 'set' operations."
                        }
                    },
                    "required": ["operation", "key"],
                    "dependencies": {
                        "operation": {
                            "oneOf": [
                                {
                                    "properties": {
                                        "operation": {
                                            "const": "set"
                                        },
                                        "value": {
                                            "type": "mixed"
                                        }
                                    },
                                    "required": ["value"]
                                },
                                {
                                    "properties": {
                                        "operation": {
                                            "const": "get"
                                        }
                                    }
                                },
                                {
                                    "properties": {
                                        "operation": {
                                            "const": "del"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "additionalProperties": false
                }
            },
            "upsert_data_entry": {
                "description": "You may control key-value properties such as user profile data in the storage with the upsert_data_entry function calling tool and arguments defined in the following schema. Prompts in human language, such as 'Update my location in user settings: Oberon.' would utilize these tools. Insert or update data entry including key, value, key_group (user_profile, general).",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "key": {
                            "type": "string",
                            "description": "Data property key."
                        },
                        "value": {
                            "type": "string",
                            "description": "Data property value."
                        },
                        "key_group": {
                            "type": "string",
                            "description": "Data key group property value.",
                            "enum": ["user_profile", "general"]
                        }
                    },
                    "required": ["key", "value", "key_group"],
                    "additionalProperties": false
                }
            },

            "retrieve_data_entry": {
                "description": "Retrieve data entry/entries by key or key_group name corresponding given value.",
                "arguments": {
                    "type": "object",
                    "properties": {
                        "field": {
                            "type": "string",
                            "description": "Data field name, key or key_group.",
                            "enum": ["key", "key_group"]
                        },
                        "value": {
                            "type": "string",
                            "description": "Data field value, key or key_group."
                        }
                    },
                    "required": ["field", "value"],
                    "additionalProperties": false
                }
            }
        }
    },
};

module.exports = {
    toolSchemas
};