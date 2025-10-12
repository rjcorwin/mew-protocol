export const INDEX_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MEW Space Navigator</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', sans-serif;
        background: #0b132b;
        color: #e0fbfc;
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      header {
        padding: 16px 24px;
        background: #1c2541;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
      h1 {
        margin: 0;
        font-size: 20px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      main {
        display: flex;
        flex-direction: row;
        flex: 1;
        overflow: hidden;
      }
      form {
        width: 320px;
        padding: 24px;
        background: #1c2541;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      label {
        display: flex;
        flex-direction: column;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(224, 251, 252, 0.75);
      }
      input, button {
        margin-top: 6px;
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(12, 17, 40, 0.85);
        color: #fff;
        font-size: 13px;
      }
      button {
        cursor: pointer;
        background: linear-gradient(120deg, #3a86ff, #8338ec);
        border: none;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(58, 134, 255, 0.4);
      }
      #status {
        min-height: 48px;
        background: rgba(12, 17, 40, 0.75);
        border-radius: 6px;
        padding: 12px;
        font-size: 12px;
        line-height: 1.4;
        color: #a9def9;
      }
      #game-container {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #game-root {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>MEW Space Navigator</h1>
    </header>
    <main>
      <form id="join-form">
        <label>
          Gateway URL
          <input type="text" name="gatewayUrl" id="gatewayUrl" placeholder="localhost" value="localhost" required />
        </label>
        <label>
          Port
          <input type="number" name="port" id="port" min="1" max="65535" value="8080" required />
        </label>
        <label>
          Username
          <input type="text" name="username" id="username" placeholder="pilot" required />
        </label>
        <label>
          Token
          <input type="text" name="token" id="token" placeholder="space token" required />
        </label>
        <button type="submit">Connect</button>
        <div id="status">Provide your gateway details to join the fleet.</div>
      </form>
      <section id="game-container">
        <div id="game-root"></div>
      </section>
    </main>
    <script type="module">
      import('__RENDERER_URL__');
    </script>
  </body>
</html>`;
