import Image from 'next/image'
import React from 'react'

import './styles.css'

// IMPORTANT: This page is completely static and does NOT query the database.
// This allows the database to scale to zero when there's no actual admin activity.

export default function HomePage() {
  return (
    <div className="home">
      <div className="content">
        <Image
          alt="Xenco Labs"
          height={80}
          src="/xencolabs-white-512.png"
          width={240}
          priority
        />
        <h1>Xenco Labs Blog CMS</h1>
        <div className="links">
          <a
            className="admin"
            href="/admin"
            rel="noopener noreferrer"
            target="_blank"
          >
            Go to admin panel
          </a>
          <a
            className="docs"
            href="https://payloadcms.com/docs"
            rel="noopener noreferrer"
            target="_blank"
          >
            Documentation
          </a>
        </div>
      </div>
      <div className="footer">
        <p>Powered by Payload CMS</p>
      </div>
    </div>
  )
}
