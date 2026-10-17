import { handleCompare } from '../../../server/handler.mjs';
export async function POST(request: Request) {
  return handleCompare(request, process.env.SARVAM_API_KEY);
}
