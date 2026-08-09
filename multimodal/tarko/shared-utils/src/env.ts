/*
 
 */
export const isTest = () => typeof process !== 'undefined' && process.env.TEST;
