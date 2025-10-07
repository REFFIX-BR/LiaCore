import { ChatInput } from '../ChatInput';

export default function ChatInputExample() {
  const handleSend = (message: string) => {
    console.log('Message sent:', message);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <ChatInput onSend={handleSend} />
    </div>
  );
}
