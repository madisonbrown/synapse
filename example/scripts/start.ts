import { Services } from '../src';

const SERVICE: keyof typeof Services = process.argv[2] as any;

Services[SERVICE].start();
