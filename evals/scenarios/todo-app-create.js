/**
 * Scenario: Create Todo List HTML App
 * 
 * Tests the agent's ability to create a functional todo list application from scratch
 */

module.exports = {
  id: 'todo-app-create',
  name: 'Create Todo List HTML App',
  description: 'Agent should create a complete, functional todo list application with HTML, CSS, and JavaScript',
  
  // Initial workspace state
  initialState: {
    files: {}  // Empty workspace
  },
  
  // The request to send to the agent
  request: {
    kind: 'chat',
    payload: {
      text: `Please create a todo list HTML application with the following features:
1. An input field to add new todos
2. A button to add the todo
3. A list showing all todos
4. Each todo should have a checkbox to mark it complete
5. Each todo should have a delete button
6. Completed todos should have strikethrough styling
7. Save it as index.html with embedded CSS and JavaScript`
    }
  },
  
  // Expected outcome
  expectedOutcome: {
    filesCreated: ['index.html'],
    functionality: {
      hasInputField: true,
      hasAddButton: true,
      hasTodoList: true,
      hasCheckboxes: true,
      hasDeleteButtons: true,
      hasStrikethroughStyling: true,
      isEmbedded: true  // CSS and JS should be in the HTML file
    },
    codeQuality: {
      validHTML: true,
      validCSS: true,
      validJavaScript: true,
      responsive: false,  // Not required for basic version
      accessible: false   // Not required for basic version
    }
  },
  
  // Expected message patterns
  expectedPatterns: [
    {
      description: 'Agent should create a proposal to write the HTML file',
      pattern: {
        kind: 'mcp/proposal',
        payload: {
          method: 'tools/call',
          params: {
            name: 'write_file'
          }
        }
      }
    }
  ],
  
  // Expected file operations
  expectedFileOps: [
    {
      operation: 'write',
      file: 'index.html',
      contentIncludes: [
        '<input',       // Input field
        '<button',      // Add button
        '<ul',          // Todo list
        'checkbox',     // Checkboxes
        'delete',       // Delete functionality
        'line-through', // Strikethrough styling
        '<style>',      // Embedded CSS
        '<script>'      // Embedded JavaScript
      ]
    }
  ],
  
  // Success criteria
  passingScore: 0.8,
  
  // Validation function (optional, for programmatic checks)
  validate: async (finalState) => {
    const htmlContent = finalState.files['index.html'];
    if (!htmlContent) return false;
    
    // Check for essential elements
    const requiredElements = [
      '<input',
      '<button',
      '<ul',
      'checkbox',
      'addEventListener',
      'line-through'
    ];
    
    return requiredElements.every(element => 
      htmlContent.toLowerCase().includes(element.toLowerCase())
    );
  }
};