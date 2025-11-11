import * as vscode from 'vscode';
import * as http from 'http';

let server: http.Server | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'cursor-grabber.toggleServer';
  context.subscriptions.push(statusBarItem);

  // Register command to toggle server
  const toggleCommand = vscode.commands.registerCommand(
    'cursor-grabber.toggleServer',
    () => {
      if (server) {
        stopServer();
      } else {
        startServer();
      }
    }
  );
  context.subscriptions.push(toggleCommand);

  const config = vscode.workspace.getConfiguration('cursorGrabber');
  if (config.get('autoStart', true)) {
    startServer();
  }
}

function startServer() {
  const config = vscode.workspace.getConfiguration('cursorGrabber');
  const port = config.get('port', 7777);

  server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/add-context') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { filePath, line, endLine } = data;

          console.log('[cursor-grabber] Received:', { filePath, line, endLine });

          await addToCursorContext(filePath, line, endLine);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error('[cursor-grabber] Error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    updateStatusBar(true, port);
    vscode.window.showInformationMessage(
      `Cursor Grabber server started on port ${port}`
    );
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      vscode.window.showErrorMessage(
        `Port ${port} is already in use. Change the port in settings or stop the other process.`
      );
    } else {
      vscode.window.showErrorMessage(
        `Failed to start server: ${error.message}`
      );
    }
    server = null;
    updateStatusBar(false);
  });
}

function stopServer() {
  if (server) {
    server.close(() => {
      vscode.window.showInformationMessage('Cursor Grabber server stopped');
    });
    server = null;
    updateStatusBar(false);
  }
}

function updateStatusBar(isRunning: boolean, port?: number) {
  if (isRunning) {
    statusBarItem.text = `$(radio-tower) Cursor Grabber :${port}`;
    statusBarItem.tooltip = 'Cursor Grabber server is running. Click to stop.';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(radio-tower) Cursor Grabber (off)';
    statusBarItem.tooltip = 'Cursor Grabber server is stopped. Click to start.';
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
  }
  statusBarItem.show();
}

async function addToCursorContext(
  filePath: string,
  line: number,
  endLine?: number
) {
  const uri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.One
  });

  const startLine = Math.max(0, line - 1);
  const finalEndLine = endLine
    ? Math.min(document.lineCount - 1, endLine - 1)
    : Math.min(document.lineCount - 1, startLine + 4);

  const startPos = new vscode.Position(startLine, 0);
  const endPos = new vscode.Position(finalEndLine, document.lineAt(finalEndLine).text.length);
  editor.selection = new vscode.Selection(startPos, endPos);

  editor.revealRange(
    new vscode.Range(startPos, endPos),
    vscode.TextEditorRevealType.InCenter
  );

  await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

  const fileName = filePath.split('/').pop();
  const lineRange = `${startLine + 1}-${finalEndLine + 1}`;
  vscode.window.showInformationMessage(
    `📋 ${fileName}:${lineRange} ready! Press Cmd+V in chat to add as context`
  );
}

export function deactivate() {
  stopServer();
}
