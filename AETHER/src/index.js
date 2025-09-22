#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk').default || require('chalk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const program = new Command();
const TASKS_FILE = path.join(os.homedir(), '.task-manager.json');

// Task data structure
let tasks = [];

// Load tasks from file
async function loadTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    tasks = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(chalk.red('Error loading tasks:'), error.message);
    }
    tasks = [];
  }
}

// Save tasks to file
async function saveTasks() {
  try {
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (error) {
    console.error(chalk.red('Error saving tasks:'), error.message);
    process.exit(1);
  }
}

// Display tasks in a formatted way
function displayTasks(tasksToShow = tasks) {
  if (tasksToShow.length === 0) {
    console.log(chalk.yellow('No tasks found.'));
    return;
  }

  console.log(chalk.blue('\n📋 Your Tasks:'));
  console.log(chalk.gray('─'.repeat(50)));

  tasksToShow.forEach((task, index) => {
    const status = task.completed ? chalk.green('✓') : chalk.red('○');
    const taskText = task.completed
      ? chalk.strikethrough.gray(task.text)
      : chalk.white(task.text);

    console.log(`${status} ${index + 1}. ${taskText}`);
    console.log(chalk.gray(`   ID: ${task.id} | Created: ${task.createdAt}`));
    if (task.completed && task.completedAt) {
      console.log(chalk.gray(`   Completed: ${task.completedAt}`));
    }
    console.log();
  });
}

// Program configuration
program
  .name('task')
  .description('A modern command-line task manager')
  .version('1.0.0');

// Add task command
program
  .command('add <text>')
  .description('Add a new task')
  .action(async (text) => {
    await loadTasks();

    const newTask = {
      id: uuidv4(),
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    tasks.push(newTask);
    await saveTasks();

    console.log(chalk.green('✓ Task added successfully!'));
    console.log(chalk.gray(`  ID: ${newTask.id}`));
  });

// List tasks command
program
  .command('list')
  .description('List all tasks')
  .option('-c, --completed', 'Show only completed tasks')
  .option('-p, --pending', 'Show only pending tasks')
  .action(async (options) => {
    await loadTasks();

    let tasksToShow = tasks;

    if (options.completed) {
      tasksToShow = tasks.filter(task => task.completed);
    } else if (options.pending) {
      tasksToShow = tasks.filter(task => !task.completed);
    }

    displayTasks(tasksToShow);
  });

// Complete task command
program
  .command('complete <id>')
  .description('Mark a task as completed')
  .action(async (id) => {
    await loadTasks();

    const task = tasks.find(t => t.id === id);
    if (!task) {
      console.log(chalk.red('✗ Task not found with ID:'), id);
      return;
    }

    if (task.completed) {
      console.log(chalk.yellow('⚠ Task is already completed.'));
      return;
    }

    task.completed = true;
    task.completedAt = new Date().toISOString();

    await saveTasks();

    console.log(chalk.green('✓ Task marked as completed!'));
    console.log(chalk.gray(`  "${task.text}"`));
  });

// Delete task command
program
  .command('delete <id>')
  .description('Delete a task')
  .action(async (id) => {
    await loadTasks();

    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      console.log(chalk.red('✗ Task not found with ID:'), id);
      return;
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];
    await saveTasks();

    console.log(chalk.green('✓ Task deleted successfully!'));
    console.log(chalk.gray(`  "${deletedTask.text}"`));
  });

// Clear all tasks command
program
  .command('clear')
  .description('Clear all tasks')
  .action(async () => {
    await loadTasks();

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks to clear.'));
      return;
    }

    const answer = await require('inquirer').prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete all ${tasks.length} tasks?`,
        default: false
      }
    ]);

    if (answer.confirm) {
      tasks = [];
      await saveTasks();
      console.log(chalk.green('✓ All tasks cleared successfully!'));
    } else {
      console.log(chalk.yellow('Operation cancelled.'));
    }
  });

// Stats command
program
  .command('stats')
  .description('Show task statistics')
  .action(async () => {
    await loadTasks();

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log(chalk.blue('\n📊 Task Statistics:'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`Total tasks: ${chalk.white(total)}`);
    console.log(`Completed: ${chalk.green(completed)}`);
    console.log(`Pending: ${chalk.red(pending)}`);
    console.log(`Completion rate: ${chalk.yellow(completionRate + '%')}`);
  });

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('An unexpected error occurred:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();