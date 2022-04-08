#!/usr/bin/env node
import chalk from 'chalk';

import { Command } from './cli';
import { assertArg, assertArgs, getProjectRoot } from './utils/args';
import * as Log from './utils/log';

export const generateCodeSigning: Command = async (argv) => {
  const args = assertArgs(
    {
      // Types
      '--help': Boolean,
      '--key-output-directory': String,
      '--certificate-output-directory': String,
      '--certificate-validity-duration-years': Number,
      '--certificate-common-name': String,
      // Aliases
      '-h': '--help',
    },
    argv ?? []
  );

  if (args['--help']) {
    Log.exit(
      chalk`
      {bold Description}
      Generate expo-updates private key, public key, and code signing certificate using that public key (self-signed by the private key)

      {bold Usage}
        $ npx expo-updates codesigning:generate

        Options
        --key-output-directory <string>                  Directory in which to put the generated private and public keys
        --certificate-output-directory <string>          Directory in which to put the generated certificate
        --certificate-validity-duration-years <number>   Validity duration in years
        --certificate-common-name <string>               Common name attribute for certificate
        -h, --help                                       Output usage information
    `,
      0
    );
  }

  const { generateCodeSigningAsync } = await import('./generateCodeSigningAsync');

  const keyOutput = assertArg(args, '--key-output-directory', 'string');
  const certificateOutput = assertArg(args, '--certificate-output-directory', 'string');
  const certificateValidityDurationYears = assertArg(
    args,
    '--certificate-validity-duration-years',
    'number'
  );
  const certificateCommonName = assertArg(args, '--certificate-common-name', 'string');

  return await generateCodeSigningAsync(getProjectRoot(args), {
    certificateValidityDurationYears,
    keyOutput,
    certificateOutput,
    certificateCommonName,
  });
};
