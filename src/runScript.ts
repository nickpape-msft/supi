import logger from '@pnpm/logger'
import path = require('path')
import byline = require('byline')
import spawn = require('cross-spawn')
import PATH = require('path-name')
import {lifecycleLogger} from './loggers'

const scriptLogger = logger('run_script')

export default function runScript (
  command: string,
  args: string[],
  opts: {
    cwd: string,
    pkgId: string,
    userAgent: string,
  }
) {
  opts = Object.assign({log: (() => {})}, opts)
  args = args || []
  const script = `${command}${args.length ? ' ' + args.join(' ') : ''}`
  if (script) scriptLogger.debug(`runscript ${script}`)
  if (!command) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: opts.cwd,
      env: createEnv(opts)
    })

    const scriptName = args[args.length - 1]

    proc.on('error', reject)
    byline(proc.stdout).on('data', (line: Buffer) => lifecycleLogger.info({
      script: scriptName,
      line: line.toString(),
      pkgId: opts.pkgId,
    }))
    byline(proc.stderr).on('data', (line: Buffer) => lifecycleLogger.error({
      script: scriptName,
      line: line.toString(),
      pkgId: opts.pkgId,
    }))

    proc.on('close', (code: number) => {
      if (code > 0) {
        lifecycleLogger.error({
          pkgId: opts.pkgId,
          script: scriptName,
          exitCode: code,
        })
        return reject(new Error('Exit code ' + code))
      }
      lifecycleLogger.info({
        pkgId: opts.pkgId,
        script: scriptName,
        exitCode: code,
      })
      return resolve()
    })
  })
}

function createEnv (
  opts: {
    cwd: string,
    userAgent?: string,
  }
) {
  const env = Object.create(process.env)

  env[PATH] = [
    path.join(opts.cwd, 'node_modules', '.bin'),
    path.dirname(process.execPath),
    process.env[PATH]
  ].join(path.delimiter)

  if (opts.userAgent) {
    env['npm_config_user_agent'] = opts.userAgent
  }

  return env
}
