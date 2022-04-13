import { getConfig } from '@expo/config';
import * as PackageManager from '@expo/package-manager';
import chalk from 'chalk';

import * as Log from '../log';
import { getVersionedPackagesAsync } from '../start/doctor/dependencies/getVersionedPackages';
import {
  getVersionedDependenciesAsync,
  logIncorrectDependencies,
} from '../start/doctor/dependencies/validateDependenciesVersions';
import { CI } from '../utils/env';
import { findUpProjectRootOrAssert } from '../utils/findUp';
import { confirmAsync } from '../utils/prompts';
import { Options } from './resolveOptions';

export async function installAsync(
  packages: string[],
  options: Options,
  packageManagerArguments: string[] = []
) {
  // Locate the project root based on the process current working directory.
  // This enables users to run `npx expo install` from a subdirectory of the project.
  const projectRoot = findUpProjectRootOrAssert(process.cwd());

  // Resolve the package manager used by the project, or based on the provided arguments.
  const packageManager = PackageManager.createForProject(projectRoot, {
    npm: options.npm,
    yarn: options.yarn,
    log: Log.log,
  });

  // Read the project Expo config without plugins.
  const { exp, pkg } = getConfig(projectRoot, {
    // Sometimes users will add a plugin to the config before installing the library,
    // this wouldn't work unless we dangerously disable plugin serialization.
    skipPlugins: true,
  });

  if (options.check || options.fix) {
    const dependencies = await getVersionedDependenciesAsync(projectRoot, exp, pkg, packages);

    if (!dependencies.length) {
      Log.exit(chalk.greenBright('Dependencies are up to date'), 0);
    } else {
      logIncorrectDependencies(dependencies);

      const value =
        // If `--fix` then always fix.
        options.fix ||
        // Otherwise prompt to fix when not running in CI.
        (!CI && (await confirmAsync({ message: 'Fix dependencies?' }).catch(() => false)));

      if (value) {
        // Just pass in the names, the install function will resolve the versions again.
        const fixedDependencies = dependencies.map((dependency) => dependency.packageName);
        Log.debug('Installing fixed dependencies:', fixedDependencies);
        // Install the corrected dependencies.
        return installPackagesAsync(projectRoot, {
          packageManager,
          packages: fixedDependencies,
          packageManagerArguments,
          sdkVersion: exp.sdkVersion!,
        });
      }
      // Exit with non-zero exit code if any of the dependencies are out of date.
      Log.exit(chalk.red('Found outdated dependencies'), 1);
    }
  }

  // Resolve the versioned packages, then install them.
  return installPackagesAsync(projectRoot, {
    packageManager,
    packages,
    packageManagerArguments,
    sdkVersion: exp.sdkVersion!,
  });
}

/** Version packages and install in a project. */
export async function installPackagesAsync(
  projectRoot: string,
  {
    packages,
    packageManager,
    sdkVersion,
    packageManagerArguments,
  }: {
    /**
     * List of packages to version
     * @example ['uuid', 'react-native-reanimated@latest']
     */
    packages: string[];
    /** Package manager to use when installing the versioned packages. */
    packageManager: PackageManager.NpmPackageManager | PackageManager.YarnPackageManager;
    /**
     * SDK to version `packages` for.
     * @example '44.0.0'
     */
    sdkVersion: string;
    /**
     * Extra parameters to pass to the `packageManager` when installing versioned packages.
     * @example ['--no-save']
     */
    packageManagerArguments: string[];
  }
): Promise<void> {
  const versioning = await getVersionedPackagesAsync(projectRoot, {
    packages,
    // sdkVersion is always defined because we don't skipSDKVersionRequirement in getConfig.
    sdkVersion,
  });

  Log.log(`Installing ${versioning.messages.join(' and ')} using ${packageManager.name}.`);

  await packageManager.addWithParametersAsync(versioning.packages, packageManagerArguments);

  await applyPluginsAsync(projectRoot, versioning.packages);
}

/**
 * A convenience feature for automatically applying Expo Config Plugins to the `app.json` after installing them.
 * This should be dropped in favor of autolinking in the future.
 */
async function applyPluginsAsync(projectRoot: string, packages: string[]) {
  const { autoAddConfigPluginsAsync } = await import('./utils/autoAddConfigPlugins');

  try {
    const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true, skipPlugins: true });

    // Only auto add plugins if the plugins array is defined or if the project is using SDK +42.
    await autoAddConfigPluginsAsync(
      projectRoot,
      exp,
      // Split any possible NPM tags. i.e. `expo@latest` -> `expo`
      packages.map((pkg) => pkg.split('@')[0]).filter(Boolean)
    );
  } catch (error: any) {
    // If we fail to apply plugins, the log a warning and continue.
    if (error.isPluginError) {
      Log.warn(`Skipping config plugin check: ` + error.message);
      return;
    }
    // Any other error, rethrow.
    throw error;
  }
}
