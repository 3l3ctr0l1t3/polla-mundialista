import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'

function App() {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <SportsSoccerIcon sx={{ mr: 1 }} aria-hidden />
          <Typography variant="h6" component="h1">
            Polla Mundialista
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Polla Mundialista
            </Typography>
            <Typography variant="body1" color="text.secondary">
              FIFA World Cup 2026 score-prediction pool. The app shell is live — features land in
              upcoming tickets.
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export default App
