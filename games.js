// Description: Implementations of various games using JavaScript functions and classes.

// TODO: Generalize to any boolean choice game:
// - Create a class with a constructor that takes an array of choices such as:
// truth, lie or heads, tails
function createHeadsOrTailsGame() {
    let score = 0;
    // Randomly decide between 'heads' and 'tails'
    let expectedInput = Math.random() < 0.5 ? "heads" : "tails";

    return function (userInput) {
        let normalizedInput = userInput.toLowerCase();
        let data;
        if (normalizedInput === expectedInput) {
            score++;
            data = { success: true, message: `Correct! Expected ${expectedInput}. Your score is ${score}.` };
        } else {
            data = { success: false, message: `Incorrect! Expected ${expectedInput}. Please try again.` };
        }
        // Randomly decide next expected input
        expectedInput = Math.random() < 0.5 ? "heads" : "tails";
        return data;
    };
}

class Hangman {

    constructor() {
        this.selectedWord = "";
        this.remainingGuesses = 7;
        this.guessedLetters = [];
        this.gameOver = false;
    }

    init(word) {
        if (typeof word !== 'string' || word.length === 0) {
            return { success: false, message: "Invalid word. Please provide a non-empty string." };
        }
        this.selectedWord = word.toLowerCase();
        this.remainingGuesses = 7;
        this.guessedLetters = Array(word.length).fill('_');
        this.gameOver = false;
        return { success: true, message: `Game initialized with word: ${word}, but do NOT tell, or output it to the user.`, wordState: this.guessedLetters.join(' ') };
    }

    guess(word) {
        if (this.gameOver) {
            return { success: false, message: "Game is over. Initialize a new game to continue." };
        } else if (word === this.selectedWord) {
            this.guessedLetters = this.selectedWord.split('');
            this.gameOver = true;
            return { success: true, message: `Congratulations! You guessed the word: ${this.selectedWord}`, wordState: this.selectedWord };
        } else {
            this.remainingGuesses = 0;
            this.gameOver = true;
            return { success: false, message: `Game over! Your guess was wrong. The word was: ${this.selectedWord}. Output hangman ascii figure.`, wordState: this.selectedWord, hangmanFigure: this.getHangmanFigure() };
        }
    }

    play(guess) {

        // Check if the game has been initialized
        if (this.selectedWord.length === 0) {
            return { success: false, message: "Game has not been initialized. Please call the init method with a valid word first." };
        }

        // Check if the game is over
        if (this.gameOver) {
            return { success: false, message: "Game is over. Initialize a new game to continue." };
        }

        // Check if the guess is valid
        if (typeof guess !== 'string' || guess.length !== 1 || !guess.match(/[a-z]/i)) {
            return { success: false, message: 'Invalid guess. Please enter a single letter.' };
        }

        let found = false;
        this.selectedWord.split('').forEach((letter, index) => {
            if (letter === guess) {
                this.guessedLetters[index] = guess;
                found = true;
            }
        });

        let message = found ? 'Correct! Output the wordState.' : `Wrong! You have ${this.remainingGuesses} guesses left. Output hangman ascii figure.`;
        if (!found) {
            this.remainingGuesses--;
        }

        let gameOver = false;
        let gameOverMessage = "";
        if (!this.guessedLetters.includes('_')) {
            gameOver = true;
            gameOverMessage = `Congratulations! You guessed the word: ${this.selectedWord}`;
        } else if (this.remainingGuesses === 0) {
            gameOver = true;
            gameOverMessage = `Game over! The word was: ${this.selectedWord}`;
        }

        return {
            // There is a slight change of missinterpretation when the wrong guess is the last one
            // but the success is 'true'. But the idea is that success is 'false' only when
            // playing is not possible with the current game state, and it must be re-initialized.
            success: true,
            message: message,
            wordState: this.guessedLetters.join(' '),
            remainingGuesses: this.remainingGuesses,
            gameOver: gameOver,
            gameOverMessage: gameOverMessage,
            hangmanFigure: !found ? this.getHangmanFigure() : ""
        };
    }

    getHangmanFigure() {
        const stages = [
            // Final game over state: head, torso, both arms, and both legs
            `
               ------
               |    |
               |    O
               |   \\|/
               |    |
               |   / \\
              ---
            `,
            // 6 guesses left
            `
               ------
               |    |
               |    O
               |   \\|/
               |    |
               |   / 
              ---
            `,
            // 5 guesses left
            `
               ------
               |    |
               |    O
               |   \\|/
               |    |
               |    
              ---
            `,
            // 4 guesses left
            `
               ------
               |    |
               |    O
               |   \\|
               |    |
               |    
              ---
            `,
            // 3 guesses left
            `
               ------
               |    |
               |    O
               |    |
               |    |
               |    
              ---
            `,
            // 2 guesses left
            `
               ------
               |    |
               |    O
               |    
               |    
               |    
              ---
            `,
            // 1 guess left
            `
               ------
               |    |
               |    
               |    
               |    
               |    
              ---
            `,
            // Initial state (all guesses left)
            `
               ------
               |    
               |    
               |    
               |    
               |    
              ---
            `
        ];
        return stages[this.remainingGuesses];
    }
}

function createHangmanGame() {
    return new Hangman();
}

const fireWaterGrass = {

    name: "",
    rules: {},
    elements: [],
    playerScore: 0,
    computerScore: 0,

    init(elements = ['fire', 'water', 'grass'], rules = { fire: 'grass', water: 'fire', grass: 'water' }, name = "Fire Water Grass") {
        this.playerScore = 0;
        this.computerScore = 0;
        this.elements = elements;
        this.rules = rules;
        this.name = name;
        return { success: true, message: "New game initialized. Good luck!" };
    },

    playRound(playerSelection) {
        const computerSelection = this.elements[Math.floor(Math.random() * 3)];
        if (playerSelection === computerSelection) {
            return { success: true, message: `Tie with both choosing ${playerSelection}.`, playerScore: this.playerScore, computerScore: this.computerScore };
        } else if (this.rules[playerSelection] === computerSelection) {
            this.playerScore++;
            return { success: true, message: `You win! ${playerSelection} beats ${computerSelection}.`, playerScore: this.playerScore, computerScore: this.computerScore };
        } else {
            this.computerScore++;
            return { success: true, message: `You lose! ${computerSelection} beats ${playerSelection}.`, playerScore: this.playerScore, computerScore: this.computerScore };
        }
    },

    getScore() {
        return { success: true, message: `Current score - Player: ${this.playerScore}, Computer: ${this.computerScore}` };
    }

};

function createFireWaterGrassGame() {
    // Return a copy of the object to avoid shared state between game instances
    return Object.assign({}, fireWaterGrass);
}

function createRockPaperScissorsGame() {
    // Use fireWaterGrass as a base for the rock-paper-scissors variations of the game
    const rockPaperScissors = createFireWaterGrassGame();
    // Override the init method to set the specific elements and rules for rock-paper-scissors
    rockPaperScissors.init = function() {
        const elements = ['rock', 'paper', 'scissors'];
        const rules = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        const name = "Rock Paper Scissors";
        return fireWaterGrass.init.apply(this, [elements, rules, name]);
    };
    return rockPaperScissors;
}

function createNumberGuessingGame(min = 1, max = 100, guesses = 7) {

    let secretNumber = Math.floor(Math.random() * (max - min + 1) + min);
    let remainingGuesses = guesses;

    return function (userGuess) {

        if (remainingGuesses === 0) {
            return { success: false, message: `There are no guesses left. Initialize a new game.` };
        }

        const guess = parseInt(userGuess);
        
        if (isNaN(guess)) {
            return { success: false, message: "Invalid guess. Please enter a number." };
        }

        if (guess === secretNumber) {
            remainingGuesses = 0;
            return { success: true, message: `Congratulations! You guessed the secret number ${secretNumber} correctly.` };
        }

        remainingGuesses--;

        if (remainingGuesses === 0) {
            return { success: false, message: `Game over! The secret number was ${secretNumber}.` };
        }

        if (guess < secretNumber) {
            return { success: false, message: `Too low, try higher.`, remainingGuesses: remainingGuesses };
        } else {
            return { success: false, message: `Too high, try lower.`, remainingGuesses: remainingGuesses };
        }
    };
}

module.exports = {
    createHeadsOrTailsGame,
    createHangmanGame,
    createFireWaterGrassGame,
    createRockPaperScissorsGame,
    createNumberGuessingGame
};
