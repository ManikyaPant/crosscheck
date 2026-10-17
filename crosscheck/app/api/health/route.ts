export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ status: 'ok', configured: Boolean(process.env.SARVAM_API_KEY), models: { speech: 'saaras:v4', reasoning: 'sarvam-105b' } }, { headers: { 'Cache-Control': 'no-store' } });
}
