
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

// In-memory storage for medications
const medications = [];
const conversationHistory = [];

// Function to format current medication list
function getMedicationList() {
  if (medications.length === 0) {
    return "No medications registered yet.";
  }
  return medications
    .map(
      (med, index) =>
        `${index + 1}. ${med.name} - ${med.dosage} at ${med.time} (${med.frequency})`
    )
    .join("\n");
}

// Function to check if any medication is due
function checkDueMedications() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const dueMeds = medications.filter((med) => {
    const [medHour, medMinute] = med.time.split(":");
    const medTime = `${String(parseInt(medHour)).padStart(2, "0")}:${String(parseInt(medMinute)).padStart(2, "0")}`;
    return medTime === currentTime;
  });

  if (dueMeds.length > 0) {
    console.log(
      "\n⏰ MEDICATION ALERT! Time to take: " +
        dueMeds.map((m) => m.name).join(", ")
    );
  }
  return dueMeds;
}

// Function to add a medication
function addMedication(name, dosage, time, frequency) {
  const medication = { name, dosage, time, frequency };
  medications.push(medication);
  return `Medication "${name}" added successfully!`;
}

// Function to remove a medication
function removeMedication(name) {
  const initialLength = medications.length;
  const filtered = medications.filter(
    (med) => med.name.toLowerCase() !== name.toLowerCase()
  );
  if (filtered.length < initialLength) {
    medications.length = 0;
    medications.push(...filtered);
    return `Medication "${name}" removed successfully!`;
  }
  return `Medication "${name}" not found.`;
}

// Function to get next scheduled medication
function getNextMedication() {
  if (medications.length === 0) {
    return "No medications scheduled.";
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let nextMed = null;
  let minDiff = 24 * 60; // Maximum minutes in a day

  medications.forEach((med) => {
    const [hours, minutes] = med.time.split(":").map(Number);
    const medMinutes = hours * 60 + minutes;
    let diff = medMinutes - currentMinutes;

    if (diff < 0) {
      diff += 24 * 60; // Next day
    }

    if (diff < minDiff) {
      minDiff = diff;
      nextMed = med;
    }
  });

  if (nextMed) {
    const hoursUntil = Math.floor(minDiff / 60);
    const minutesUntil = minDiff % 60;
    return `Next medication: ${nextMed.name} (${nextMed.dosage}) at ${nextMed.time} - ${hoursUntil}h ${minutesUntil}m from now`;
  }

  return "No upcoming medications today.";
}

// Process user commands with Claude
async function processCommand(userInput) {
  conversationHistory.push({
    role: "user",
    content: userInput,
  });

  const systemPrompt = `You are a helpful medication reminder assistant. You help users manage their medications.

Current Medications:
${getMedicationList()}

Available actions you can suggest:
1. Add medication: "add [medication name] [dosage] [time HH:MM] [frequency]"
2. Remove medication: "remove [medication name]"
3. List all medications: "list"
4. Get next medication: "next"
5. Check due medications: "check"

When users ask to add or remove medications, provide the command they should use.
If a user asks about their medications, provide helpful information based on the current list.
Be friendly and encourage medication adherence.

For commands:
- "add aspirin 500mg 09:00 daily" -> Adds aspirin
- "remove aspirin" -> Removes aspirin
- "list" -> Shows all medications
- "next" -> Shows next scheduled medication
- "check" -> Shows any due medications

Respond naturally and helpfully. If the user wants to perform an action, tell them the exact command to execute.`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";
  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  return assistantMessage;
}

// Main function to run the app
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🏥 Medication Reminder App");
  console.log("Type 'help' for commands or ask Claude for assistance.");
  console.log('Type "exit" to quit.\n');

  // Check for due medications periodically
  const checkInterval = setInterval(() => {
    checkDueMedications();
  }, 60000); // Check every minute

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      const command = input.trim().toLowerCase();

      if (command === "