const FIELD_SEPARATOR = '|';
const VECTOR_SEPARATOR = ',';
const VERSION_TAG = '1';
const NULL_SENTINEL = '~';
const MAX_VECTOR_COMPONENTS = 2;

export interface MovementFrame {
  participantId: string;
  timestamp: number;
  world: { x: number; y: number };
  tile: { x: number; y: number };
  velocity: { x: number; y: number };
  platformRef: string | null;
}

function formatScalar(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  return rounded.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function parseScalar(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function encodeVector(vector: { x: number; y: number }): string {
  return `${formatScalar(vector.x)}${VECTOR_SEPARATOR}${formatScalar(vector.y)}`;
}

function decodeVector(value: string): { x: number; y: number } | null {
  const components = value.split(VECTOR_SEPARATOR);
  if (components.length !== MAX_VECTOR_COMPONENTS) {
    return null;
  }

  const [x, y] = components;
  const parsedX = parseScalar(x);
  const parsedY = parseScalar(y);

  if (parsedX === null || parsedY === null) {
    return null;
  }

  return { x: parsedX, y: parsedY };
}

export function encodeMovementFrame(frame: MovementFrame): string {
  const platformField = frame.platformRef === null ? NULL_SENTINEL : encodeURIComponent(frame.platformRef);
  const timestampField = Math.round(frame.timestamp).toString(36);
  const participantField = encodeURIComponent(frame.participantId);

  return [
    VERSION_TAG,
    participantField,
    timestampField,
    encodeVector(frame.world),
    encodeVector(frame.tile),
    encodeVector(frame.velocity),
    platformField,
  ].join(FIELD_SEPARATOR);
}

export function decodeMovementFrame(payload: string): MovementFrame | null {
  if (!payload) {
    return null;
  }

  const fields = payload.split(FIELD_SEPARATOR);
  if (fields.length !== 7) {
    return null;
  }

  const [version, participantIdField, timestampField, worldField, tileField, velocityField, platformField] = fields;

  if (version !== VERSION_TAG || !participantIdField) {
    return null;
  }

  const timestamp = parseInt(timestampField, 36);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  let participantId: string;
  let platformRef: string | null;
  try {
    participantId = decodeURIComponent(participantIdField);
    platformRef = platformField === NULL_SENTINEL ? null : decodeURIComponent(platformField);
  } catch {
    return null;
  }

  const world = decodeVector(worldField);
  const tile = decodeVector(tileField);
  const velocity = decodeVector(velocityField);

  if (!world || !tile || !velocity) {
    return null;
  }

  return {
    participantId,
    timestamp,
    world,
    tile,
    velocity,
    platformRef,
  };
}
