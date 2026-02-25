import { EventEmitter } from "events";

const pollEvents = new EventEmitter();

// 0 = unlimited listeners, useful when many clients subscribe to SSE updates.
pollEvents.setMaxListeners(0);

const getEventKey = (pollId) => `poll:${String(pollId)}:results`;

export const publishPollResults = (pollId) => {
  pollEvents.emit(getEventKey(pollId));
};

export const subscribeToPollResults = (pollId, listener) => {
  const eventKey = getEventKey(pollId);
  pollEvents.on(eventKey, listener);

  return () => {
    pollEvents.off(eventKey, listener);
  };
};
