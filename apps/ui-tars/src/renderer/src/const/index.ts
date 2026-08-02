/**
 
 */
import { Operator } from '@main/store/types';

export const COMPUTER_OPERATOR = 'Computer Operator';
export const BROWSER_OPERATOR = 'Browser Operator';

export const OPERATOR_URL_MAP = {
  [Operator.RemoteComputer]: {
    text: 'Use Orbit Beta Remote Computer Operator with your preferred vision-language model.',
    url: 'https://github.com/Aaryanshukla11',
  },
  [Operator.RemoteBrowser]: {
    text: 'Use Orbit Beta Remote Browser Operator with your preferred vision-language model.',
    url: 'https://github.com/Aaryanshukla11',
  },
};
