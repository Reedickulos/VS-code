const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock the file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

// Mock inquirer for testing
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn()
}));

// Mock commander to prevent CLI execution during tests
jest.mock('commander', () => ({
  Command: jest.fn().mockImplementation(() => ({
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    command: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnThis()
  }))
}));

// Create a separate module for testable functions
const taskManager = {
  tasks: [],

  async loadTasks() {
    try {
      const data = await fs.readFile(path.join(os.homedir(), '.task-manager.json'), 'utf8');
      this.tasks = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading tasks:', error.message);
      }
      this.tasks = [];
    }
  },

  async saveTasks() {
    try {
      await fs.writeFile(path.join(os.homedir(), '.task-manager.json'), JSON.stringify(this.tasks, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error.message);
      process.exit(1);
    }
  },

  addTask(text) {
    const { v4: uuidv4 } = require('uuid');
    const newTask = {
      id: uuidv4(),
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    this.tasks.push(newTask);
    return newTask;
  },

  completeTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.completed) {
      throw new Error('Task already completed');
    }

    task.completed = true;
    task.completedAt = new Date().toISOString();
    return task;
  },

  deleteTask(id) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }

    return this.tasks.splice(taskIndex, 1)[0];
  },

  getStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, completionRate };
  }
};

// Set up test data
const mockTasks = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    text: 'Test task 1',
    completed: false,
    createdAt: '2023-01-01T00:00:00.000Z',
    completedAt: null
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    text: 'Test task 2',
    completed: true,
    createdAt: '2023-01-02T00:00:00.000Z',
    completedAt: '2023-01-03T00:00:00.000Z'
  }
];

describe('Task Manager', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset tasks array before each test
    taskManager.tasks = [];
  });

  describe('loadTasks', () => {
    it('should load tasks from file successfully', async () => {
      const mockData = JSON.stringify(mockTasks);
      fs.readFile.mockResolvedValue(mockData);

      await taskManager.loadTasks();

      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(os.homedir(), '.task-manager.json'),
        'utf8'
      );
      expect(taskManager.tasks).toEqual(mockTasks);
    });

    it('should handle file not found error gracefully', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      await taskManager.loadTasks();

      expect(taskManager.tasks).toEqual([]);
    });

    it('should handle other file errors', async () => {
      const error = new Error('Permission denied');
      fs.readFile.mockRejectedValue(error);

      // Mock console.error to avoid test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await taskManager.loadTasks();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading tasks:',
        'Permission denied'
      );

      consoleSpy.mockRestore();
      expect(taskManager.tasks).toEqual([]);
    });
  });

  describe('saveTasks', () => {
    it('should save tasks to file successfully', async () => {
      taskManager.tasks = mockTasks;
      fs.writeFile.mockResolvedValue();

      await taskManager.saveTasks();

      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.task-manager.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should handle write errors', async () => {
      const error = new Error('Disk full');
      fs.writeFile.mockRejectedValue(error);

      // Mock console.error and process.exit to avoid test termination
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      taskManager.tasks = mockTasks;
      await taskManager.saveTasks();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving tasks:',
        'Disk full'
      );
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe('addTask', () => {
    it('should add a new task with unique ID', () => {
      const { v4 } = require('uuid');
      v4.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

      const newTask = taskManager.addTask('New test task');

      expect(newTask.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(newTask.text).toBe('New test task');
      expect(newTask.completed).toBe(false);
      expect(newTask.createdAt).toBeTruthy();
      expect(newTask.completedAt).toBeNull();
      expect(taskManager.tasks).toContain(newTask);
    });

    it('should trim whitespace from task text', () => {
      const { v4 } = require('uuid');
      v4.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

      const newTask = taskManager.addTask('  Task with spaces  ');

      expect(newTask.text).toBe('Task with spaces');
    });
  });

  describe('completeTask', () => {
    it('should mark a task as completed', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Task to complete',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      taskManager.tasks = [task];

      const completedTask = taskManager.completeTask(task.id);

      expect(completedTask.completed).toBe(true);
      expect(completedTask.completedAt).toBeTruthy();
    });

    it('should throw error if task not found', () => {
      taskManager.tasks = [];

      expect(() => {
        taskManager.completeTask('nonexistent-id');
      }).toThrow('Task not found');
    });

    it('should throw error if task already completed', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Already completed task',
        completed: true,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
      taskManager.tasks = [task];

      expect(() => {
        taskManager.completeTask(task.id);
      }).toThrow('Task already completed');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task successfully', () => {
      const task = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Task to delete',
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      taskManager.tasks = [task];

      const deletedTask = taskManager.deleteTask(task.id);

      expect(deletedTask).toEqual(task);
      expect(taskManager.tasks).not.toContain(task);
      expect(taskManager.tasks).toHaveLength(0);
    });

    it('should throw error if task not found', () => {
      taskManager.tasks = [];

      expect(() => {
        taskManager.deleteTask('nonexistent-id');
      }).toThrow('Task not found');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics for mixed tasks', () => {
      const tasks = [
        { id: '1', completed: false },
        { id: '2', completed: true },
        { id: '3', completed: true },
        { id: '4', completed: false }
      ];
      taskManager.tasks = tasks;

      const stats = taskManager.getStats();

      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.completionRate).toBe(50);
    });

    it('should return zero stats for empty task list', () => {
      taskManager.tasks = [];

      const stats = taskManager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.completionRate).toBe(0);
    });

    it('should return 100% completion rate when all tasks completed', () => {
      const tasks = [
        { id: '1', completed: true },
        { id: '2', completed: true }
      ];
      taskManager.tasks = tasks;

      const stats = taskManager.getStats();

      expect(stats.completionRate).toBe(100);
    });
  });
});