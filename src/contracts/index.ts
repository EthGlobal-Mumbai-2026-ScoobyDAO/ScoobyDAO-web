import { zeroAddress } from 'viem';
import type { Deployments } from '@/lib/types';
import sepoliaJson from './sepolia.json';

export * from './abis';

export const deployments = sepoliaJson as Deployments;
export const addresses = deployments.contracts;

/** False while sepolia.json is the placeholder (all zero addresses). */
export const contractsDeployed = addresses.VerdictMarket !== zeroAddress && addresses.ClaimRegistry !== zeroAddress;
