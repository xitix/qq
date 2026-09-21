/**
 * Downsampling pentru performanță - limitează punctele afișate în grafice
 * Păstrează primul și ultimul punct întotdeauna
 */
export function downsample<T>(data: T[], maxPoints: number = 300): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  // Asigură-te că ultimul punct este inclus
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
}
