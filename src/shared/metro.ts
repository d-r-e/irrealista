export interface MetroLine {
  shortName: string;
  color: string;
  textColor: string;
}

export interface MetroRoute {
  stationName: string;
  distanceMeters: number;
  durationSeconds: number;
  lines: MetroLine[];
}

export interface MetroRouteResult {
  route: MetroRoute | null;
  error?: string;
}
