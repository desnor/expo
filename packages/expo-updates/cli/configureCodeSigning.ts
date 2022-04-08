#!/usr/bin/env node
import chalk from 'chalk';

import { Command } from './cli';
import { assertArg, assertArgs, getProjectRoot } from './utils/args';
import * as Log from './utils/log';

export const configureCodeSigning: Command = async (argv) => {
  const args = assertArgs(
    {
      // Types
      '--help': Boolean,
      '--certificate-input-directory': String,
      '--key-input-directory': String,
      // Aliases
      '-h': '--help',
    },
    argv ?? []
  );

  if (args['--help']) {
    Log.exit(
      chalk`
      {bold Description}
      Configure and validate expo-updates code signing for this project

      {bold Usage}
        $ npx expo-updates codesigning:configure

        Options
        --certificate-input-directory <string>     Directory containing code signing certificate
        --key-input-directory <string>             Directory containing private and public keys
        -h, --help               Output usage information
    `,
      0
    );
  }

  const { configureCodeSigningAsync } = await import('./configureCodeSigningAsync');

  const certificateInput = assertArg(args, '--certificate-input-directory', 'string');
  const keyInput = assertArg(args, '--key-input-directory', 'string');

  return await configureCodeSigningAsync(getProjectRoot(args), {
    certificateInput,
    keyInput,
  });
};
