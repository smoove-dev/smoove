import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { useEffect, useState } from "react";
import { useEditorContext } from "../../hooks/use-editor-context.js";
import type { ModelInfo } from "../../types.js";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../ai-elements/conversation.js";
import { Message, MessageContent, MessageResponse } from "../ai-elements/message.js";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input.js";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "../ai-elements/tool.js";

export type ChatRailProps = {
  /** The agent endpoint. `${endpoint}/models` must also exist. */
  endpoint?: string;
};

/** The left rail: model picker, conversation, composer. Replaces studio's Sidebar. */
export function ChatRail({ endpoint = "/api/agent" }: ChatRailProps) {
  const getContext = useEditorContext();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: endpoint }),
  });

  useEffect(() => {
    let live = true;
    fetch(`${endpoint}/models`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ModelInfo[]) => {
        if (!live) return;
        setModels(list);
        setModelId((cur) => cur ?? list[0]?.id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [endpoint]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;
    sendMessage({ text: message.text }, { body: { modelId, context: getContext() } });
  };

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-r border-line bg-bg-0">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-display text-sm text-ink-1">smoove editor</span>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Describe the motion"
              description="smoove will build it."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    // Parts stream in append-only, so their index is a stable key.
                    const key = `${message.id}-${i}`;
                    if (part.type === "text") {
                      return <MessageResponse key={key}>{part.text}</MessageResponse>;
                    }
                    if (part.type.startsWith("tool-")) {
                      const t = part as ToolUIPart;
                      return (
                        <Tool key={key}>
                          <ToolHeader type={t.type} state={t.state} />
                          <ToolContent>
                            <ToolInput input={t.input} />
                            <ToolOutput output={t.output} errorText={t.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={handleSubmit} className="m-3">
        <PromptInputBody>
          <PromptInputTextarea placeholder="Describe the motion…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {models.length > 0 ? (
              <PromptInputSelect value={modelId} onValueChange={setModelId}>
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((m) => (
                    <PromptInputSelectItem key={m.id} value={m.id}>
                      {m.label}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            ) : null}
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            disabled={status === "submitted"}
            onClick={
              status === "streaming"
                ? (e) => {
                    e.preventDefault();
                    stop();
                  }
                : undefined
            }
          />
        </PromptInputFooter>
      </PromptInput>
    </aside>
  );
}
