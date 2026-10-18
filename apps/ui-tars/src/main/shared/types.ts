/*
 
 */
import { Conversation } from '@UI-TARs/shared/types';

export interface ConversationWithSoM extends Conversation {
  screenshotBase64WithElementMarker?: string;
}
