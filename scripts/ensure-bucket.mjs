// Crée le bucket privé s'il n'existe pas (dev local et CI uniquement, jamais en production).
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const { S3_ENDPOINT, S3_REGION = "auto", S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  throw new Error("Variables S3_* manquantes");
}

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION === "auto" ? "us-east-1" : S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

for (let attempt = 1; ; attempt++) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Bucket ${S3_BUCKET} présent`);
    break;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
      console.log(`Bucket ${S3_BUCKET} créé`);
      break;
    }
    if (attempt >= 20) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
