import { Resend } from "resend";

async function testResend() {
  // Hardcoded for direct verification since dotenv is not a dependency
  const apiKey = "re_RFUj15JU_B2xEtQsWZHsZB3kvJ2qh3fTX";
  const from = "onboarding@mailmind.se";
  const to = "emiltorsson@outlook.com";

  console.log("Testing Resend with key:", apiKey.substring(0, 7) + "...");
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Test from Mailmind Dev",
      html: "<p>Resend is working correctly!</p>",
    });

    if (error) {
      console.error("❌ Resend Error:", JSON.stringify(error, null, 2));
    } else {
      console.log("✅ Resend Success! ID:", data?.id);
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

testResend();
