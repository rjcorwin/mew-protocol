/**
 * Scenario: Change Background Color of Todo App
 * 
 * Tests the agent's ability to read an existing file and modify it
 */

module.exports = {
  id: 'todo-app-bgcolor',
  name: 'Change Todo App Background Color',
  description: 'Agent should read the existing todo app and change its background color',
  
  // Initial workspace state (assumes todo-app-create has run)
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
      text: 'Please change the background color of the todo app to light blue (#e3f2fd). Make sure to update the body background color.'
    }
  },
  
  // Expected outcome
  expectedOutcome: {
    filesModified: ['index.html'],
    changes: {
      backgroundColorChanged: true,
      colorValue: '#e3f2fd',
      preservedFunctionality: true
    }
  },
  
  // Expected message patterns
  expectedPatterns: [
    {
      description: 'Agent should read the existing file first',
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
      description: 'Agent should then edit or write the file',
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
      contentIncludes: ['#e3f2fd', 'background']
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
          m.payload?.params?.name?.includes('read') &&
          m.payload?.params?.arguments?.path === 'index.html'
        );
      }
    },
    {
      name: 'Modify background color',
      required: true,
      validation: (messages) => {
        return messages.some(m => 
          m.kind === 'mcp/proposal' &&
          (m.payload?.params?.name === 'edit_file' || m.payload?.params?.name === 'write_file')
        );
      }
    }
  ],
  
  // Success criteria
  passingScore: 0.85,
  
  // Validation function
  validate: async (finalState) => {
    const htmlContent = finalState.files['index.html'];
    if (!htmlContent) return false;
    
    // Check if background color was changed
    const hasNewColor = htmlContent.includes('#e3f2fd');
    const hasBackgroundStyle = htmlContent.includes('background') || htmlContent.includes('background-color');
    
    // Check if functionality is preserved
    const functionalityPreserved = [
      'addTodo',
      'toggleComplete',
      'deleteTodo',
      'checkbox',
      'delete-btn'
    ].every(feature => htmlContent.includes(feature));
    
    return hasNewColor && hasBackgroundStyle && functionalityPreserved;
  }
};