'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Pencil, Download, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Role = 'user' | 'assistant' | 'system'

interface Message {
  role: Role
  content: string
}

interface Conversation {
  messages: Message[]
}

interface ParsingError {
  line: number
  content: string
}

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [errors, setErrors] = useState<ParsingError[]>([])
  const [editingMessage, setEditingMessage] = useState<number | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target?.result as string
        parseContent(content)
      }
      reader.readAsText(file)
    }
  }, [])

  const parseContent = useCallback((content: string) => {
    const lines = content.split('\n')
    const parsedConversations: Conversation[] = []
    const newErrors: ParsingError[] = []

    lines.forEach((line: string, index: number) => {
      if (line.trim() !== '') {
        try {
          const parsedLine = JSON.parse(line) as Conversation
          parsedConversations.push(parsedLine)
        } catch (error) {
          newErrors.push({ line: index + 1, content: line })
        }
      }
    })

    setConversations(parsedConversations)
    setSelectedConversation(null)
    setErrors(newErrors)
  }, [])

  const handleConversationSelect = useCallback((index: number) => {
    setSelectedConversation(conversations[index])
    setEditingMessage(null)
  }, [conversations])

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }, [])

  const handleMessageEdit = useCallback((conversationIndex: number, messageIndex: number) => {
    setConversations((prevConversations) => {
      const updatedConversations = [...prevConversations]
      const updatedConversation = { ...updatedConversations[conversationIndex] }
      const updatedMessages = [...updatedConversation.messages]

      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: editedContent,
      }

      updatedConversation.messages = updatedMessages
      updatedConversations[conversationIndex] = updatedConversation

      return updatedConversations
    })

    setSelectedConversation((prevSelected) => {
      if (prevSelected) {
        const updatedMessages = [...prevSelected.messages]
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: editedContent,
        }
        return { ...prevSelected, messages: updatedMessages }
      }
      return prevSelected
    })

    setEditingMessage(null)
    setEditedContent('')
  }, [editedContent])

  const handleDownload = useCallback(() => {
    if (conversations.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data available to download. Please import or create some data first.",
      })
      return
    }

    const code = conversations.map(conv => JSON.stringify(conv)).join('\n')
    const blob = new Blob([code], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'conversations.jsonl'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [conversations, toast])

  const filteredConversations = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase()
    return conversations.filter((conv, index) => {
      const searchContent = JSON.stringify(conv).toLowerCase()
      return (
        searchContent.includes(lowerSearchTerm) ||
        `Conversation ${index + 1}`.toLowerCase().includes(lowerSearchTerm)
      )
    })
  }, [conversations, searchTerm])

  useEffect(() => {
    if (filteredConversations.length > 0 && !selectedConversation) {
      setSelectedConversation(filteredConversations[0])
    }
  }, [filteredConversations, selectedConversation])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">JSONL Viewer and Editor</h1>
      <div className="mb-4 flex gap-2">
        <input
          type="file"
          accept=".jsonl"
          onChange={handleFileUpload}
          className="hidden"
          ref={fileInputRef}
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          Import JSONL File
        </Button>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" /> Download JSONL
        </Button>
      </div>
      {errors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errors found in JSONL file</AlertTitle>
          <AlertDescription>
            The following lines could not be parsed:
            <ul className="list-disc list-inside">
              {errors.map(({ line, content }, index) => (
                <li key={index}>Line {line}: {content}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversations List */}
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="mt-2"
            />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {filteredConversations.length > 0 ? (
                <ul className="space-y-2">
                  {filteredConversations.map((conv, index) => {
                    const originalIndex = conversations.indexOf(conv)
                    return (
                      <li key={originalIndex}>
                        <Button
                          variant={selectedConversation === conv ? "default" : "outline"}
                          onClick={() => handleConversationSelect(originalIndex)}
                          className="w-full justify-start"
                        >
                          <span className="truncate">
                            Conversation {originalIndex + 1}:
                            {conv.messages[1]?.content.substring(0, 30)}...
                          </span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>No conversations found.</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected Conversation */}
        <Card>
          <CardHeader>
            <CardTitle>Selected Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {selectedConversation ? (
                <div className="space-y-4">
                  {selectedConversation.messages.map((message, messageIndex) => (
                    <div key={messageIndex} className="border p-2 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <strong>{message.role}:</strong>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingMessage(messageIndex)
                            setEditedContent(message.content)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      {editingMessage === messageIndex ? (
                        <div className="flex items-center gap-2">
                          <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="flex-grow"
                            rows={3}
                          />
                          <Button
                            size="icon"
                            onClick={() =>
                              handleMessageEdit(
                                conversations.indexOf(selectedConversation),
                                messageIndex
                              )
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No conversation selected</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
