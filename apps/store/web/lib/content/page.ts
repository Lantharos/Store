export interface Heading {
  id: string
  text: string
}

export interface Page {
  slug: string
  title: string
  description: string
  html: string
  headings: Heading[]
}
