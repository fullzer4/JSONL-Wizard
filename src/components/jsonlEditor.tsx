'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Pencil, Download, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Message {
  role: string
  content: string
}

interface Conversation {
  messages: Message[]
}

interface ParsingError {
  line: number
  content: string
}

export default function JsonlEditor() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [errors, setErrors] = useState<ParsingError[]>([])
  const [editingMessage, setEditingMessage] = useState<number | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const content = await file.text()
      parseContent(content)
      updateServerCode(content)
    }
  }

  const parseContent = (content: string) => {
    const lines = content.split('\n')
    const parsedConversations: Conversation[] = []
    const newErrors: ParsingError[] = []

    lines.forEach((line: string, index: number) => {
      if (line.trim() !== '') {
        try {
          const parsedLine = JSON.parse(line)
          parsedConversations.push(parsedLine)
        } catch (error) {
          newErrors.push({ line: index + 1, content: line })
        }
      }
    })

    setConversations(parsedConversations)
    setSelectedConversation(null)
    setErrors(newErrors)
  }

  const handleConversationSelect = (index: number) => {
    setSelectedConversation(conversations[index])
    setEditingMessage(null)
  }

  const handleMessageEdit = (conversationIndex: number, messageIndex: number) => {
    const updatedConversations = [...conversations]
    updatedConversations[conversationIndex].messages[messageIndex].content = editedContent
    setConversations(updatedConversations)
    setSelectedConversation(updatedConversations[conversationIndex])
    updateServerCode(updatedConversations.map(conv => JSON.stringify(conv)).join('\n'))
    setEditingMessage(null)
    setEditedContent('')
  }

  const updateServerCode = async (newCode: string) => {
    try {
      const response = await fetch('/api/update-jsonl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: newCode }),
      })
      if (!response.ok) {
        throw new Error('Failed to update server code')
      }
    } catch (error) {
      console.error('Error updating server code:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update server code. Please try again.",
      })
    }
  }

  const handleDownload = async () => {
    if (conversations.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data available to download. Please import or create some data first.",
      })
      return
    }

    try {
      const response = await fetch('/api/get-jsonl')
      if (!response.ok) {
        throw new Error('Failed to fetch JSONL data')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'conversations.jsonl'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading JSONL:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download JSONL. Please try again.",
      })
    }
  }

  const filteredConversations = conversations.filter((conv: Conversation, index: number) => {
    const searchContent = JSON.stringify(conv).toLowerCase()
    return searchContent.includes(searchTerm.toLowerCase()) || 
           `Conversation ${index + 1}`.toLowerCase().includes(searchTerm.toLowerCase())
  })

  useEffect(() => {
    if (filteredConversations.length > 0 && !selectedConversation) {
      setSelectedConversation(filteredConversations[0])
    }
  }, [filteredConversations, selectedConversation])

  return (
    <>
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
              {errors.map((error: ParsingError, index: number) => (
                <li key={index}>Line {error.line}: {error.content}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <ul className="space-y-2">
                {filteredConversations.map((conv: Conversation, index: number) => {
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
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Selected Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {selectedConversation ? (
                <div className="space-y-4">
                  {selectedConversation.messages.map((message: Message, messageIndex: number) => (
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
                            onClick={() => handleMessageEdit(
                              conversations.indexOf(selectedConversation),
                              messageIndex
                            )}
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
    </>
  )
}
