/**
 * Scenario: Add Priority Feature to Todo App
 * 
 * Tests the agent's ability to add a new feature to an existing application
 */

module.exports = {
  id: 'todo-app-feature',
  name: 'Add Priority Feature to Todo App',
  description: 'Agent should add a priority selection feature to the existing todo app',
  
  // Initial workspace state (assumes previous scenarios have run)
  initialState: {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo List App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #e3f2fd;
        }
        .todo-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .completed {
            text-decoration: line-through;
            opacity: 0.6;
        }
        .todo-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .delete-btn {
            margin-left: auto;
            background: #ff4444;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="todo-container">
        <h1>My Todo List</h1>
        <div>
            <input type="text" id="todoInput" placeholder="Add a new todo...">
            <button onclick="addTodo()">Add Todo</button>
        </div>
        <ul id="todoList"></ul>
    </div>
    <script>
        function addTodo() {
            const input = document.getElementById('todoInput');
            const text = input.value.trim();
            if (!text) return;
            
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.innerHTML = \`
                <input type="checkbox" onchange="toggleComplete(this)">
                <span>\${text}</span>
                <button class="delete-btn" onclick="deleteTodo(this)">Delete</button>
            \`;
            
            document.getElementById('todoList').appendChild(li);
            input.value = '';
        }
        
        function toggleComplete(checkbox) {
            const item = checkbox.parentElement;
            if (checkbox.checked) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        }
        
        function deleteTodo(button) {
            button.parentElement.remove();
        }
    </script>
</body>
</html>`
    }
  },
  
  // The request to send to the agent
  request: {
    kind: 'chat',
    payload: {
      text: `Please add a priority feature to the todo app:
1. Add a dropdown select next to the input field with three priority levels: High, Medium, Low
2. Display the priority as a colored badge next to each todo item
3. Use red for High, yellow for Medium, and green for Low priority
4. Make sure the priority is included when adding new todos`
    }
  },
  
  // Expected outcome
  expectedOutcome: {
    filesModified: ['index.html'],
    features: {
      hasPriorityDropdown: true,
      hasColoredBadges: true,
      priorityLevels: ['High', 'Medium', 'Low'],
      colorCoding: {
        high: 'red',
        medium: 'yellow',
        low: 'green'
      },
      preservedExistingFeatures: true
    }
  },
  
  // Expected message patterns
  expectedPatterns: [
    {
      description: 'Agent should read the existing file',
      pattern: {
        kind: 'mcp/proposal',
        payload: {
          method: 'tools/call',
          params: {
            name: /read.*file/
          }
        }
      }
    },
    {
      description: 'Agent should modify the file with new feature',
      pattern: {
        kind: 'mcp/proposal',
        payload: {
          method: 'tools/call',
          params: {
            name: /(edit_file|write_file)/
          }
        }
      }
    }
  ],
  
  // Expected file operations
  expectedFileOps: [
    {
      operation: 'read',
      file: 'index.html'
    },
    {
      operation: 'edit',
      file: 'index.html',
      contentIncludes: [
        '<select',      // Priority dropdown
        'High',         // Priority levels
        'Medium',
        'Low',
        'priority',     // Priority-related code
        'badge',        // Priority badge
        'red',          // Color coding
        'yellow',
        'green'
      ]
    }
  ],
  
  // Multi-step validation
  steps: [
    {
      name: 'Read existing file',
      required: true,
      validation: (messages) => {
        return messages.some(m => 
          m.kind === 'mcp/proposal' &&
          m.payload?.params?.name?.includes('read')
        );
      }
    },
    {
      name: 'Add HTML for priority dropdown',
      required: true,
      validation: (finalState) => {
        const html = finalState.files['index.html'];
        return html && html.includes('<select');
      }
    },
    {
      name: 'Add CSS for priority badges',
      required: true,
      validation: (finalState) => {
        const html = finalState.files['index.html'];
        return html && (
          html.includes('.priority-high') ||
          html.includes('.priority-badge') ||
          html.includes('badge')
        );
      }
    },
    {
      name: 'Update JavaScript to handle priorities',
      required: true,
      validation: (finalState) => {
        const html = finalState.files['index.html'];
        return html && html.includes('priority') && html.includes('getElementById');
      }
    }
  ],
  
  // Success criteria
  passingScore: 0.85,
  
  // Validation function
  validate: async (finalState) => {
    const htmlContent = finalState.files['index.html'];
    if (!htmlContent) return false;
    
    // Check for new priority features
    const hasDropdown = htmlContent.includes('<select');
    const hasPriorityOptions = ['High', 'Medium', 'Low'].every(p => 
      htmlContent.includes(p)
    );
    const hasColorCoding = ['red', 'yellow', 'green'].some(c => 
      htmlContent.includes(c)
    );
    
    // Check if existing functionality is preserved
    const existingFeatures = [
      'addTodo',
      'toggleComplete',
      'deleteTodo',
      'checkbox',
      '#e3f2fd'  // Background color from previous scenario
    ].every(feature => htmlContent.includes(feature));
    
    return hasDropdown && hasPriorityOptions && hasColorCoding && existingFeatures;
  }
};