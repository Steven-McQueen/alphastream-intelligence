import { ChatInterface, ModelId } from '@/components/chat/ChatInterface';

interface IndexChatProps {
  indexName: string;
  indexSymbol: string;
}

export function IndexChat({ indexName, indexSymbol }: IndexChatProps) {
  const handleSubmit = async (message: string, model: ModelId): Promise<string> => {
    // This is where you would integrate with your actual AI backend
    // For now, return a mock response
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      return `Analyzing ${indexName} (${indexSymbol}):\n\n"${message}"\n\nThe ${indexName} is currently showing mixed signals. Key factors to watch include sector rotation, earnings trends, and macro indicators.\n\nThis is a mock response - integrate with your AI backend for real analysis.`;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  };

  return (
    <ChatInterface
      contextType="index"
      contextLabel={indexName}
      placeholder={`Ask anything about ${indexName}...`}
      suggestedPrompts={[
        `What's driving ${indexSymbol} today?`,
        `Key factors affecting ${indexSymbol}`,
        `${indexSymbol} outlook for this week`,
        `Compare ${indexSymbol} to other indices`,
      ]}
      onSubmit={handleSubmit}
      className="h-[400px]"
      compact
    />
  );
}
