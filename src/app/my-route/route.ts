// IMPORTANT: This route does NOT initialize Payload/database connection.
// Previously it called getPayload() which created a DB connection even though
// the payload instance was never used. This wasted database resources.

export const GET = async (request: Request) => {
  return Response.json({
    message: 'This is an example of a custom route.',
  })
}
