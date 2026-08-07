/*
 
 */
import { Conversation } from '@ui-tars/shared/types';

export interface ConversationWithSoM extends Conversation {
  screenshotBase64WithElementMarker?: string;
}
