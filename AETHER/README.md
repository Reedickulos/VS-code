# Task Manager CLI

A modern, feature-rich command-line task management application built with Node.js. This CLI tool helps you manage your daily tasks efficiently with a beautiful, colorized interface.

## ✨ Features

- **📝 Add Tasks**: Create new tasks with unique IDs
- **📋 List Tasks**: View all tasks with filtering options
- **✅ Complete Tasks**: Mark tasks as completed with timestamps
- **🗑️ Delete Tasks**: Remove tasks you no longer need
- **📊 Statistics**: View completion statistics and progress
- **🎨 Beautiful UI**: Colorized output with icons and formatting
- **💾 Persistent Storage**: Tasks saved to JSON file in home directory
- **🔄 Interactive Mode**: Confirmation prompts for destructive operations
- **⚡ Fast & Lightweight**: Built with modern Node.js practices

## 🚀 Installation

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager

### Install Globally

```bash
npm install -g .
```

Or if you prefer yarn:

```bash
yarn global add .
```

### Install Locally for Development

```bash
npm install
```

## 📖 Usage

### Basic Commands

#### Add a new task
```bash
task add "Complete project documentation"
```

#### List all tasks
```bash
task list
```

#### List only pending tasks
```bash
task list --pending
```

#### List only completed tasks
```bash
task list --completed
```

#### Mark a task as completed
```bash
task complete 123e4567-e89b-12d3-a456-426614174000
```

#### Delete a task
```bash
task delete 123e4567-e89b-12d3-a456-426614174000
```

#### Clear all tasks (with confirmation)
```bash
task clear
```

#### View statistics
```bash
task stats
```

### Command Reference

| Command | Description | Options |
|---------|-------------|---------|
| `add <text>` | Add a new task | - |
| `list` | List all tasks | `--completed`, `--pending` |
| `complete <id>` | Mark task as completed | - |
| `delete <id>` | Delete a task | - |
| `clear` | Clear all tasks | - |
| `stats` | Show task statistics | - |

## 🎯 Examples

### Daily Workflow

```bash
# Start your day by adding tasks
task add "Review pull requests"
task add "Update documentation"
task add "Team standup meeting"

# Check your progress
task list

# Complete a task
task complete 123e4567-e89b-12d3-a456-426614174000

# View statistics
task stats

# Clean up completed tasks
task list --completed
task delete 123e4567-e89b-12d3-a456-426614174001
```

### Project Management

```bash
# Project setup
task add "Set up project repository"
task add "Install dependencies"
task add "Configure CI/CD pipeline"
task add "Write unit tests"
task add "Create documentation"

# Track progress
task list --pending
task stats
```

## 🔧 Configuration

Tasks are stored in a JSON file located at:
- **Linux/macOS**: `~/.task-manager.json`
- **Windows**: `%USERPROFILE%\\.task-manager.json`

The file contains an array of task objects with the following structure:

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "text": "Sample task",
    "completed": false,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "completedAt": null
  }
]
```

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 🏗️ Development

### Project Structure

```
├── src/
│   └── index.js          # Main CLI application
├── tests/
│   └── index.test.js     # Test suite
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

### Key Technologies

- **Commander.js**: Command-line argument parsing
- **Chalk**: Terminal text styling
- **Inquirer.js**: Interactive command-line prompts
- **UUID**: Unique identifier generation
- **Jest**: Testing framework

### Adding New Features

1. Add the command to `src/index.js`
2. Write corresponding tests in `tests/index.test.js`
3. Update this README with usage examples
4. Test the feature thoroughly

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include your Node.js version and operating system

## 🗺️ Roadmap

- [ ] Export tasks to CSV/JSON
- [ ] Import tasks from external sources
- [ ] Task categories and tags
- [ ] Due date support
- [ ] Priority levels
- [ ] Task templates
- [ ] Integration with external task managers
- [ ] Web interface
- [ ] Mobile app

---

**Made with ❤️ using modern Node.js practices**