import { handleCompare } from '../../../server/handler.mjs';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleCompare(request, process.env.SARVAM_API_KEY);
}
