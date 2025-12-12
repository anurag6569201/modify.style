import csv
from datetime import datetime, timedelta

# --- CONFIGURATION ---
# Default: Starts tomorrow. Change this string (YYYY-MM-DD) if you want a specific start date.
start_date_str = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
# ---------------------

current_date = datetime.strptime(start_date_str, '%Y-%m-%d')

# Format: (Subject, Description)
roadmap = [
    # --- MONTH 1: THE DATABASE ENGINE (Internals) ---
    ("Day 1: Storage Engines (LSM Trees)", 
     "THEORY: Read DDIA Chapter 3. Focus on SSTables, Memtables, and Log-Structured storage. LAB: Write a script in Go/Python that appends Key-Values to a log file (Write Ahead Log) and reads them back."),
    
    ("Day 2: Memtable Implementation", 
     "THEORY: Understand Red-Black Trees vs Skip Lists for in-memory storage. LAB: Implement an in-memory Memtable (using a TreeMap) that flushes to disk as an immutable SSTable when full."),
    
    ("Day 3: Bloom Filters", 
     "THEORY: Study Probabilistic Data Structures. Understand why they never return False Negatives. LAB: Implement a Bloom Filter from scratch using MurmurHash. Prove false positives exist."),
    
    ("Day 4: Compaction Strategies", 
     "THEORY: Compare Size-Tiered vs Leveled Compaction (used in Cassandra/LevelDB). LAB: Write a background script that merges two sorted SSTable files into one new file (Merge Sort)."),
    
    ("Day 5: Deep Dive - BigTable", 
     "WATCH: MIT 6.824 Lecture 3 (GFS). READ: The Google BigTable Paper. ANALYSIS: Connect the dots between GFS (File System) and BigTable (KV Store)."),
    
    ("Day 6: Code Review - LevelDB", 
     "TASK: Clone the LevelDB or BadgerDB (Go) repository. Trace the 'Put' and 'Get' functions in the source code to see how they handle concurrency."),
    
    ("Day 7: Encoding & Evolution", 
     "THEORY: Read DDIA Chapter 4. Understand Avro/Protobuf vs JSON. LAB: Define an Avro schema. Write code to 'evolve' it (add a field) and verify old code can still read the new data."),
    
    ("Day 8: B-Trees (Mutable Indexing)", 
     "THEORY: Read DDIA Chapter 3 (B-Trees section). Understand Branching Factors and Depth. LAB: Use 'strace' on a SQLite process to watch 4KB pages being read from disk."),
    
    ("Day 9: Page Structures", 
     "THEORY: Deep dive into Slotted Pages and Free Lists. LAB: Implement a basic B-Tree Node class in code that can hold keys and child pointers (do not implement balancing yet)."),
    
    ("Day 10: Crash Recovery (WAL)", 
     "THEORY: Write-Ahead Logs (WAL) and Checkpoints. ARIES algorithm basics. LAB: Implement a 'Recover' function that reads your WAL file and reconstructs the Memtable after a 'crash'."),
    
    ("Day 11: Columnar Storage", 
     "THEORY: Read about Parquet and Clickhouse. Understand Column-oriented vs Row-oriented storage. LAB: Convert a CSV file to a Binary Columnar format. Compare file size/compression."),
    
    ("Day 12: Deep Dive - Dremel", 
     "READ: Google's Dremel Paper (The basis of BigQuery). Focus on how they handle Nested Data structures efficiently."),
    
    ("Day 13: Benchmark Day", 
     "LAB: Write a benchmark suite. Generate 1 million keys. Compare Random Write performance on your LSM Code vs your B-Tree Code. Observe the write amplification."),
    
    ("Day 14: Infrastructure as Code (IaC)", 
     "THEORY: Declarative vs Imperative infrastructure. LAB: Write a Terraform script to provision a local Docker container or a free-tier AWS EC2 instance."),
    
    ("Day 15: Transactions (ACID)", 
     "THEORY: Read DDIA Chapter 7. Define Atomicity, Consistency, Isolation, Durability. LAB: Write a test script that proves MongoDB single-document ACID compliance."),
    
    ("Day 16: Isolation Levels", 
     "THEORY: Understand Read Committed vs Repeatable Read. LAB: Open two Postgres terminals. demonstrate 'Dirty Write' and 'Lost Update' phenomena manually."),
    
    ("Day 17: Snapshot Isolation (MVCC)", 
     "THEORY: Multi-Version Concurrency Control. LAB: Inspect Postgres 'xmin' and 'xmax' system columns during a transaction to see how it stores multiple versions."),
    
    ("Day 18: Serializability", 
     "THEORY: 2PL (Two-Phase Locking) vs SSI (Serializable Snapshot Isolation). LAB: Simulate a Deadlock in SQL using explicit locking commands."),
    
    ("Day 19: Distributed Transactions", 
     "THEORY: Two-Phase Commit (2PC) vs Sagas. LAB: Implement a basic 2PC Coordinator between two mock microservices (Order Service and Payment Service)."),
    
    ("Day 20: Deep Dive - Spanner", 
     "WATCH: MIT 6.824 Lecture 13 (Spanner). READ: Google's Spanner Paper. Understand TrueTime, Atomic Clocks, and External Consistency."),
    
    ("Day 21: Batch Processing", 
     "WATCH: MIT 6.824 Lecture 1 (Introduction/MapReduce). THEORY: Read DDIA Chapter 10. LAB: Write a Python script mimicking Map and Reduce phases on a 1GB text file."),
    
    ("Day 22: Network Internals", 
     "WATCH: MIT 6.824 Lecture 2 (RPC & Threads). LAB: Wireshark Deep Dive. Capture packets and analyze the TCP Handshake and HTTPS Overhead."),
    
    ("Day 23: OS I/O Internals", 
     "THEORY: Standard I/O vs mmap vs O_DIRECT. Page Cache. LAB: Benchmark reading a 1GB file using standard read() vs mmap(). Explain the difference."),
    
    ("Day 24: I/O Multiplexing", 
     "THEORY: blocking I/O vs select vs poll vs epoll. LAB: Write a basic TCP server using the 'epoll' system call (or your language's async equivalent)."),
    
    ("Day 25: HTTP Protocols", 
     "THEORY: HTTP/1.1 vs HTTP/2 (Multiplexing) vs HTTP/3 (QUIC/UDP). LAB: Load test an HTTP/2 server. Observe how multiple requests share one connection."),
    
    ("Day 26: Load Balancing", 
     "THEORY: L4 vs L7 Load Balancing. Algorithms (Round Robin, Least Conn). LAB: Implement 'Weighted Round Robin' algorithm in Python/Go code."),
    
    ("Day 27: Deep Dive - NGINX", 
     "READ: NGINX Architecture Overview. Understand the Event Loop model vs Apache's Thread-per-request model."),
    
    ("Day 28: Month 1 Review", 
     "REVIEW: Re-read DDIA Ch 3 & 7 highlights. Organize your notes. Ensure your DB engine code compiles and runs."),

    # --- MONTH 2: DISTRIBUTED SYSTEMS THEORIST ---
    ("Day 29: Replication", 
     "WATCH: MIT 6.824 Lecture 4 (Primary-Backup). THEORY: Read DDIA Chapter 5. LAB: Setup MySQL Replication. Kill the master. Promote slave manually."),
    
    ("Day 30: Replication Lag", 
     "THEORY: Statement-based vs Row-based logs. Problems with Lag. LAB: Measure replication lag time under heavy write load (insert 10k rows)."),
    
    ("Day 31: Quorums", 
     "THEORY: R + W > N. Consistency levels. LAB: Write a script to simulate Quorum reads/writes with node failures. Calculate probability of stale reads."),
    
    ("Day 32: Consistency Models", 
     "THEORY: Linearizability vs Eventual Consistency. LAB: Read Jepsen.io analysis of MongoDB or Cassandra. Understand how they lose data."),
    
    ("Day 33: Logical Clocks", 
     "THEORY: Physical vs Logical Clocks. Lamport Clocks vs Vector Clocks. LAB: Implement Vector Clocks code to detect concurrent updates in a distributed list."),
    
    ("Day 34: Deep Dive - Dynamo", 
     "READ: Amazon's Dynamo Paper. Focus on the 'Shopping Cart' use case, Ring Hashing, and Vector Clocks."),
    
    ("Day 35: Security Deep Dive", 
     "THEORY: OWASP Top 10. XSS, CSRF, SQLi. LAB: Perform a SQL Injection on your local DB, then patch it using Prepared Statements."),
    
    ("Day 36: Partitioning (Sharding)", 
     "THEORY: Read DDIA Chapter 6. Key-Range vs Hash Partitioning. LAB: Manually shard a SQLite DB across 3 files based on UserID."),
    
    ("Day 37: Consistent Hashing", 
     "THEORY: The Hash Ring & Virtual Nodes. LAB: Code a Consistent Hash Ring. Add a node and programmatically count how many keys needed to move."),
    
    ("Day 38: Rebalancing", 
     "THEORY: Dynamic Partitioning strategies. LAB: Simulate the 'Justin Bieber' (Hot Partition/Skew) problem in your hashing code."),
    
    ("Day 39: Gossip Protocols", 
     "THEORY: SWIM Protocol / Request Routing. Failure Detection. LAB: Implement a basic heartbeat/ping check between 3 nodes."),
    
    ("Day 40: Deep Dive - Ringpop", 
     "READ: Uber's 'Ringpop' blog post. Understand application-layer sharding and member lists."),
    
    ("Day 41: Lab: Sharded KV Store", 
     "TASK: Combine your Month 1 DB Engine + Month 2 Consistent Hashing logic to make a distributed Key-Value store."),
    
    ("Day 42: CDN Internals", 
     "THEORY: Anycast IP, PoPs, Cache Invalidation Patterns. LAB: Setup Cloudflare (Free) for a static site and inspect headers."),

    ("Day 43: Byzantine Generals", 
     "THEORY: The Two Generals Problem. Understand why 100% Consensus is mathematically impossible in asynchronous networks."),
    
    ("Day 44: Paxos Basics", 
     "THEORY: Paxos Phases (Prepare/Promise, Propose/Accept). Don't code yet, just understand the Proposer/Acceptor roles."),
    
    ("Day 45: Raft (Leader Election)", 
     "WATCH: MIT 6.824 Lecture 6 (Raft I). LAB: Use the Raft Visualization tool online. Understand Random Timeouts."),
    
    ("Day 46: Raft (Log Replication)", 
     "WATCH: MIT 6.824 Lecture 7 (Raft II). THEORY: The Replicated Log. LAB: Define the Structs/Classes needed for a Raft Node (Term, Log, Index)."),
    
    ("Day 47: Lab - Build Raft (Part 1)", 
     "TASK: Implement the 'Leader Election' ticker and voting logic in Go/Python. Nodes should vote for a candidate."),
    
    ("Day 48: Lab - Build Raft (Part 2)", 
     "TASK: Implement the 'AppendEntries' RPC to replicate logs from Leader to Followers. Handle the heartbeat."),
    
    ("Day 49: Raft Edge Cases", 
     "THEORY: Split Votes & Network Partitions. TASK: Test your Raft implementation by simulating a network partition (drop packets)."),
    
    ("Day 50: ZooKeeper/Etcd", 
     "WATCH: MIT 6.824 Lecture 8 (ZooKeeper). THEORY: Atomic Broadcast (ZAB). LAB: Run Etcd. Use 'etcdctl' to set keys and watch changes."),
    
    ("Day 51: Distributed Locks", 
     "THEORY: The Redlock Algorithm. LAB: Implement a Distributed Lock using Redis (Set NX PX) with a TTL."),
    
    ("Day 52: Leader Election (Applied)", 
     "THEORY: Using ZK/Etcd for election. LAB: Write 2 Node apps that compete to become 'Active' using the Distributed Lock you built."),
    
    ("Day 53: Service Discovery", 
     "THEORY: Client-side vs Server-side discovery. DNS vs Registry. LAB: Register your mock services into Consul or Etcd."),
    
    ("Day 54: Deep Dive - Chubby", 
     "READ: Google's Chubby Paper. Understand Coarse-grained locking and how it differs from ZooKeeper."),
    
    ("Day 55: Month 2 Review", 
     "REVIEW: Review DDIA Ch 5, 6, 9. Review your Raft code. Ensure you understand why Split Brain happens."),
    
    ("Day 56: Formal Verification", 
     "THEORY: TLA+ Basics. Watch Leslie Lamport's Intro. LAB: Write a simple spec for a bank transfer to see race conditions mathematically."),

    # --- MONTH 3: CLOUD NATIVE & BIG DATA ---
    ("Day 57: Caching Patterns", 
     "THEORY: Cache-Aside, Write-Through, Thundering Herd. LAB: Implement 'Request Collapsing' middleware to prevent Thundering Herd."),
    
    ("Day 58: Kafka Internals", 
     "THEORY: Topics, Partitions, Offsets, Segments. LAB: Inspect Kafka data files on disk. Identify the .log and .index files."),
    
    ("Day 59: Consumer Patterns", 
     "THEORY: Consumer Groups & Rebalancing protocol. LAB: Start 1 producer, 3 consumers. Kill one consumer, watch the rebalance triggers."),
    
    ("Day 60: Message Delivery", 
     "THEORY: At-most-once vs At-least-once. LAB: Write a consumer that crashes before committing the offset. Observe duplicate processing."),
    
    ("Day 61: Lab - Exactly Once", 
     "TASK: Build a payment processor using Kafka Transactions (read-process-write atomic). Understand the 'fencing zombie' problem."),
    
    ("Day 62: Deep Dive - LinkedIn Logs", 
     "READ: LinkedIn 'Log Structured Streaming' blog. Understand why the Log is the heart of data infrastructure."),
    
    ("Day 63: Stream Processing", 
     "THEORY: Read DDIA Chapter 11. Time Windows (Tumbling vs Sliding). LAB: Implement a Sliding Window counter (e.g., requests in last 5 mins)."),
    
    ("Day 64: Kubernetes Architecture", 
     "THEORY: API Server, Etcd, Controller Manager, Scheduler. LAB: 'Kubernetes the Hard Way' (Do the Control Plane setup step)."),
    
    ("Day 65: Service Mesh", 
     "THEORY: The Sidecar Pattern (Envoy/Istio). LAB: Install Istio. Visualize traffic graph between 2 pods using Kiali/Jaeger."),
    
    ("Day 66: Circuit Breakers", 
     "THEORY: Fail Fast to prevent cascading failure. LAB: Implement a Circuit Breaker in code. Test it with a failing backend service."),
    
    ("Day 67: API Gateways", 
     "THEORY: BFF Pattern, Rate Limiting, TLS Termination. LAB: Configure Nginx as a Gateway performing Rate Limiting."),
    
    ("Day 68: Deep Dive - Borg", 
     "READ: Google's Borg Paper. Compare the 'Alloc' concept to Kubernetes Pods."),
    
    ("Day 69: Lab - K8s Operator", 
     "TASK: Write a simple custom Kubernetes Controller in Go/Python that monitors a ConfigMap and updates a Deployment."),
    
    ("Day 70: Formal Verification (Cloud)", 
     "THEORY: How AWS proves network correctness (Zelkova). Read AWS automated reasoning blog."),
    
    ("Day 71: Tracing", 
     "THEORY: Distributed Context Propagation (TraceID/SpanID). LAB: Instrument an app with Jaeger/OpenTelemetry."),
    
    ("Day 72: Metrics", 
     "THEORY: Prometheus (Pull model) vs Push model. LAB: Expose custom metrics (/metrics endpoint) and scrape them with Prometheus."),
    
    ("Day 73: Logging", 
     "THEORY: Structured Logging (JSON) vs Text. ELK Stack. LAB: Setup Fluentd to ship logs from Docker to a file or Elasticsearch."),
    
    ("Day 74: Auth Deep Dive", 
     "THEORY: OAuth2 flows (Auth Code vs Client Creds). OIDC. LAB: Manually construct an OAuth2 request to Google/GitHub."),
    
    ("Day 75: mTLS & Zero Trust", 
     "THEORY: Mutual TLS (Two-way authentication). LAB: Generate CA certificates and configure 2-way SSL between two microservices."),
    
    ("Day 76: Lab - Observability Dashboard", 
     "TASK: Build a Grafana Dashboard showing 95th percentile latency and Error Rates for your test app."),
    
    ("Day 77: Chaos Engineering", 
     "THEORY: Netflix Chaos Monkey. LAB: Write a script that randomly kills your Docker containers. Ensure the system recovers."),
    
    ("Day 78: Big Data (Batch - Spark)", 
     "WATCH: MIT 6.824 Lecture 15 (Spark). THEORY: Read DDIA Chapter 10. RDDs. LAB: Write a Spark job to process a large CSV."),
    
    ("Day 79: Lambda vs Kappa", 
     "THEORY: Architecture Patterns. Lambda (Speed+Batch) vs Kappa (Stream only). LAB: Draw the architecture for a system needing both Real-time and Historical views."),
    
    ("Day 80: Vector Databases", 
     "THEORY: Embeddings & HNSW Index. LAB: Use OpenAI API to get text embeddings, store them in Pinecone/Milvus."),
    
    ("Day 81: Lab - Semantic Search", 
     "TASK: Build a search bar that finds documents based on 'meaning', not keywords, using your Vector DB."),
    
    ("Day 82: Data Warehousing", 
     "THEORY: Snowflake Architecture (Separation of Compute/Storage). Star Schema vs Snowflake Schema."),
    
    ("Day 83: Deep Dive - MapReduce", 
     "READ: Google's MapReduce Paper. Understand the Shuffle/Sort phase details."),
    
    ("Day 84: Month 3 Review", 
     "REVIEW: Review Cloud patterns, Kafka internals, and Observability tools."),

    # --- MONTH 4: THE ARCHITECT (Synthesis) ---
    ("Day 85: Design Typeahead", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Tries, Prefix search, Top-k caching. Handling trending searches."),
    
    ("Day 86: Design Web Crawler", 
     "SOURCE: Alex Xu Vol 1. FOCUS: URL Frontier, Politeness, DNS resolution, Robot.txt handling."),
    
    ("Day 87: Design Dist Scheduler", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Cron at scale, Leader election for scheduler, Etcd usage."),
    
    ("Day 88: Design Ad Aggregator", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Stream processing, Lambda Architecture, Exactly-once counting."),
    
    ("Day 89: Design Collab Editor", 
     "SOURCE: Google Docs logic. FOCUS: Operational Transformation (OT) vs CRDTs. LAB: Build a simple CRDT counter in JS."),
    
    ("Day 90: Design Geo-Spatial", 
     "SOURCE: Alex Xu Vol 2 (Uber/Yelp). FOCUS: QuadTrees vs Geohashes. LAB: Play with Redis GEO commands."),
    
    ("Day 91: Design Digital Wallet", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Double-entry ledger, Distributed Transactions, Sagas, Idempotency."),
    
    ("Day 92: Design Twitter", 
     "SOURCE: Alex Xu Vol 1. FOCUS: Fan-out on Write vs Fan-out on Read. Hybrid approach for celebrities."),
    
    ("Day 93: Design WhatsApp", 
     "SOURCE: Alex Xu Vol 1. FOCUS: End-to-End Encryption, WebSocket handling, Push Notifications."),
    
    ("Day 94: Design Netflix", 
     "SOURCE: Alex Xu Vol 1. FOCUS: CDN Design, Adaptive Bitrate Streaming, Pre-computing videos."),
    
    ("Day 95: Design Google Drive", 
     "SOURCE: Alex Xu Vol 1. FOCUS: Block-level splitting, Hashing for Deduplication, Sync conflict resolution."),
    
    ("Day 96: Design Payment Gateway", 
     "SOURCE: Stripe Clone. FOCUS: Idempotency keys, Reliability, Reconciliation jobs."),
    
    ("Day 97: Design Stock Exchange", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Matching Engine (FIFO), Ultra-low latency, Multicast for market data."),
    
    ("Day 98: Design Hotel Booking", 
     "SOURCE: Alex Xu Vol 2. FOCUS: Concurrency. Handling Overbooking. Optimistic vs Pessimistic Locking."),
    
    ("Day 99: Mock Interview 1", 
     "TOPIC: Top K Leaderboard (Gaming). TASK: Record yourself explaining the design for 45 mins. Review the video."),
    
    ("Day 100: Mock Interview 2", 
     "TOPIC: Ticketmaster (Booking). TASK: Record yourself. Focus on the locking mechanism for tickets."),
    
    ("Day 101: Mock Interview 3", 
     "TOPIC: TinyURL (Unique IDs). TASK: Record yourself. Focus on Base62 encoding and ID generation."),
    
    ("Day 102: Mock Interview 4", 
     "TOPIC: Notification Service. TASK: Record yourself. Focus on Queue workers and rate limiting."),
    
    ("Day 103: Mock Interview 5", 
     "TOPIC: Rate Limiter. TASK: Record yourself. Focus on Token Bucket algorithm implementation."),
    
    ("Day 104: Mock Interview 6", 
     "TOPIC: Instagram. TASK: Record yourself. Focus on Feed generation and Image storage."),
    
    ("Day 105: Mock Interview 7", 
     "TOPIC: Parking Garage. TASK: Record yourself. Focus on Object-Oriented Design + System limits."),
    
    ("Day 106: Capstone 1 - Crypto Exchange", 
     "TASK: Design a Global Crypto Exchange. Create a 5-page Architecture Doc. Handle Race conditions & Ledger integrity."),
    
    ("Day 107: Capstone 1 - Work", 
     "TASK: Define the API Spec (gRPC) and Database Schema (SQL). Draw the component diagram."),
    
    ("Day 108: Capstone 1 - Review", 
     "TASK: Self-Audit. What happens if the Matching Engine crashes? How do you recover state?"),
    
    ("Day 109: Capstone 2 - Zoom Competitor", 
     "TASK: Design a Video Conference system. Focus on UDP vs TCP, WebRTC, and Media Servers."),
    
    ("Day 110: Capstone 2 - Work", 
     "TASK: Define Signaling Server logic and Data center selection logic. Draw the diagram."),
    
    ("Day 111: Capstone 2 - Review", 
     "TASK: Self-Audit. How do you handle packet loss? How does the system scale to 1000 users?"),
    
    ("Day 112: The Future of Data", 
     "READ: DDIA Chapter 12. Data Integration & Unbundling Databases. The Unix philosophy applied to data."),
    
    ("Day 113: Review Weakness", 
     "FOCUS: Revisit Raft or Consensus if you are shaky. Re-watch MIT Lecture 6/7 if needed."),
    
    ("Day 114: Review Weakness", 
     "FOCUS: Revisit DB Internals (LSM vs B-Tree). Ensure you can explain write amplification."),
    
    ("Day 115: Review Weakness", 
     "FOCUS: Revisit K8s/Cloud patterns. Ensure you understand Sidecars and Ingress."),
    
    ("Day 116: Final Polish", 
     "TASK: Review Design Interview cheat sheets. Memorize Latency numbers (RAM vs Disk vs Network)."),
    
    ("Day 117: Final Polish", 
     "TASK: Re-read your notes from Month 1. Trace the journey from a single log file to a distributed database."),
    
    ("Day 118: Final Polish", 
     "TASK: Mental Prep. Visualize a successful design interview. Draw one final system just for fun."),
    
    ("Day 119: Rest", 
     "TASK: Do absolutely nothing. Sleep. Let the knowledge settle."),
    
    ("Day 120: MASTERY ACHIEVED", 
     "STATUS: You are now a Principal Engineer level architect. Congratulations."),
]

filename = 'system_design_mastery_complete.csv'
with open(filename, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['Subject', 'Start Date', 'Description', 'All Day Event'])
    
    for subject, desc in roadmap:
        writer.writerow([subject, current_date.strftime('%m/%d/%Y'), desc, 'True'])
        current_date += timedelta(days=1)

print(f"Successfully created '{filename}'.")
print(f"Start Date: {start_date_str}")
print("Action: Import this into Google Calendar via Settings > Import.")