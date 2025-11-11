// 启动本地接口，访问时唤起vscode
import http from 'http';
import portFinder from 'portfinder';
// import { launchIDE } from 'launch-ide'; // Not needed - extension handles everything
import { DefaultPort } from '../shared/constant';
import { getIP, getProjectRecord, setProjectRecord, findPort } from '../shared';
import type { PathType, CodeOptions, RecordInfo } from '../shared';
import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';

// 获取项目 git 根目录
function getProjectRoot(): string {
  try {
    const command = 'git rev-parse --show-toplevel';
    const gitRoot = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return gitRoot;
  } catch (error) {
    return '';
  }
}

// 项目根目录
export const ProjectRootPath = getProjectRoot();
export function getRelativePath(filePath: string): string {
  if (ProjectRootPath) {
    return filePath.replace(`${ProjectRootPath}/`, '');
  }
  return filePath;
}

// 根据用户配置返回绝对路径或者相对路径
export function getRelativeOrAbsolutePath(
  filePath: string,
  pathType?: PathType
) {
  return pathType === 'relative' ? getRelativePath(filePath) : filePath;
}

export function createServer(
  callback: (port: number) => any,
  options?: CodeOptions,
  _record?: RecordInfo // Prefixed with _ to suppress unused warning
) {
  const server = http.createServer((req: any, res: any) => {
    // 收到请求唤醒vscode
    const params = new URLSearchParams(req.url.slice(1));
    let file = decodeURIComponent(params.get('file') as string);
    if (ProjectRootPath && !path.isAbsolute(file)) {
      file = `${ProjectRootPath}/${file}`;
    }
    if (
      options?.pathType === 'relative' &&
      ProjectRootPath &&
      !file.startsWith(ProjectRootPath)
    ) {
      res.writeHead(403, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
      });
      res.end('not allowed to open this file');
      return;
    }
    const line = Number(params.get('line'));
    const column = Number(params.get('column'));
    const endLine = Number(params.get('endLine') || line); // fallback to line if not provided
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end('ok');
    // 调用 hooks
    options?.hooks?.afterInspectRequest?.(options, { file, line, column });

    console.log(options?.editor)

    // 🔥 CURSOR EXTENSION INTEGRATION - Send to VS Code extension for auto-paste
    if (options?.editor === 'cursor') {
      console.log('in cursor block')

      const http = require('http');
      const postData = JSON.stringify({
        filePath: file,
        line,
        endLine
      });

      const extReq = http.request({
        hostname: 'localhost',
        port: 7777,
        path: '/add-context',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, () => {
        console.log('[code-inspector] ✅ Sent to Cursor extension');
      });

      extReq.on('error', () => {
        // Silently fail if extension not running
      });

      extReq.write(postData);
      extReq.end();
    }

    // 打开 IDE
    // launchIDE({
    //   file,
    //   line,
    //   column,
    //   editor: options?.editor,
    //   method: options?.openIn,
    //   format: options?.pathFormat,
    //   rootDir: record?.envDir,
    // });
  });

  // 寻找可用接口
  portFinder.getPort(
    { port: options?.port ?? DefaultPort },
    (err: Error, port: number) => {
      if (err) {
        throw err;
      }
      server.listen(port, () => {
        callback(port);
      });
    }
  );
  return server;
}

export async function startServer(options: CodeOptions, record: RecordInfo) {
  if (getProjectRecord(record)?.port) {
    return;
  }
  let restartServer = !getProjectRecord(record)?.findPort;

  if (restartServer) {
    const findPort = new Promise<number>((resolve) => {
      // create server
      createServer(
        (port: number) => {
          resolve(port);
          if (options.printServer) {
            const info = [
              chalk.blue('[code-inspector-plugin]'),
              'Server is running on:',
              chalk.green(
                `http://${getIP(options.ip || 'localhost')}:${
                  options.port ?? DefaultPort
                }`
              ),
            ];
            console.log(info.join(' '));
          }
        },
        options,
        record
      );
    });
    // record the server of current project
    setProjectRecord(record, 'findPort', 1);
    const port = await findPort;
    setProjectRecord(record, 'port', port);
  }

  if (!getProjectRecord(record)?.port) {
    const port = await findPort(record);
    setProjectRecord(record, 'port', port);
  }
}
