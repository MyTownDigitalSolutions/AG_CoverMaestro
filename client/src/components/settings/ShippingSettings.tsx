import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Button, FormControl, InputLabel,
    Select, MenuItem, TextField, Tabs, Tab, Grid, Card, CardContent
} from '@mui/material';
import { settingsApi, enumsApi } from '../../services/api';
import { ShippingRateCard, ShippingRateTier, ShippingZoneRate, MarketplaceShippingProfile, EnumValue } from '../../types';

export const ShippingSettings: React.FC = () => {
    const [tab, setTab] = useState(0);

    return (
        <Box sx={{ p: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label="Rate Cards" />
                <Tab label="Tiers" />
                <Tab label="Zone Rates" />
                <Tab label="Marketplace Profiles" />
            </Tabs>
            {tab === 0 && <RateCardsTab />}
            {tab === 1 && <TiersTab />}
            {tab === 2 && <ZoneRatesTab />}
            {tab === 3 && <MarketplaceProfilesTab />}
        </Box>
    );
};

const RateCardsTab = () => {
    const [cards, setCards] = useState<ShippingRateCard[]>([]);
    const [carriers, setCarriers] = useState<EnumValue[]>([]);
    const [newName, setNewName] = useState("");
    const [newCarrier, setNewCarrier] = useState("");

    const load = async () => {
        const [c, car] = await Promise.all([settingsApi.listRateCards(), enumsApi.carriers()]);
        setCards(c);
        setCarriers(car);
    };
    useEffect(() => { load(); }, []);

    const create = async () => {
        await settingsApi.createRateCard({ name: newName, carrier: newCarrier });
        load();
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField label="Name" size="small" value={newName} onChange={e => setNewName(e.target.value)} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Carrier</InputLabel>
                    <Select value={newCarrier} label="Carrier" onChange={e => setNewCarrier(e.target.value)}>
                        {carriers.map(c => <MenuItem key={c.value} value={c.value}>{c.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button variant="contained" onClick={create}>Add Card</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Name</TableCell><TableCell>Carrier</TableCell></TableRow></TableHead>
                    <TableBody>
                        {cards.map(c => <TableRow key={c.id}><TableCell>{c.id}</TableCell><TableCell>{c.name}</TableCell><TableCell>{c.carrier}</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

const TiersTab = () => {
    const [cards, setCards] = useState<ShippingRateCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<number | ''>('');
    const [tiers, setTiers] = useState<ShippingRateTier[]>([]);
    const [min, setMin] = useState("");
    const [max, setMax] = useState("");

    useEffect(() => { settingsApi.listRateCards().then(setCards) }, []);
    useEffect(() => {
        if (selectedCard) settingsApi.listTiers(Number(selectedCard)).then(setTiers);
        else setTiers([]);
    }, [selectedCard]);

    const create = async () => {
        if (!selectedCard) return;
        await settingsApi.createTier({ rate_card_id: Number(selectedCard), min_oz: parseFloat(min), max_oz: parseFloat(max) });
        settingsApi.listTiers(Number(selectedCard)).then(setTiers);
    };

    return (
        <Box>
            <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Rate Card</InputLabel>
                <Select value={selectedCard} label="Select Rate Card" onChange={e => setSelectedCard(e.target.value as number)}>
                    {cards.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.carrier})</MenuItem>)}
                </Select>
            </FormControl>

            {selectedCard && (
                <Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField label="Min oz" size="small" type="number" value={min} onChange={e => setMin(e.target.value)} />
                        <TextField label="Max oz" size="small" type="number" value={max} onChange={e => setMax(e.target.value)} />
                        <Button variant="contained" onClick={create}>Add Tier</Button>
                    </Box>
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Min Oz</TableCell><TableCell>Max Oz</TableCell></TableRow></TableHead>
                            <TableBody>
                                {tiers.map(t => <TableRow key={t.id}><TableCell>{t.id}</TableCell><TableCell>{t.min_oz}</TableCell><TableCell>{t.max_oz}</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}
        </Box>
    );
};

const ZoneRatesTab = () => {
    const [cards, setCards] = useState<ShippingRateCard[]>([]);
    const [tiers, setTiers] = useState<ShippingRateTier[]>([]);
    const [selectedCard, setSelectedCard] = useState<number | ''>('');
    const [selectedTier, setSelectedTier] = useState<number | ''>('');
    const [rates, setRates] = useState<ShippingZoneRate[]>([]);

    // Quick Add
    const [zone, setZone] = useState("");
    const [rate, setRate] = useState("");

    useEffect(() => { settingsApi.listRateCards().then(setCards) }, []);
    useEffect(() => { if (selectedCard) settingsApi.listTiers(Number(selectedCard)).then(setTiers) }, [selectedCard]);
    useEffect(() => { if (selectedTier) settingsApi.listZoneRates(Number(selectedTier)).then(setRates) }, [selectedTier]);

    const saveRate = async () => {
        if (!selectedCard || !selectedTier) return;
        await settingsApi.createZoneRate({
            rate_card_id: Number(selectedCard),
            tier_id: Number(selectedTier),
            zone: parseInt(zone),
            rate_cents: parseInt(rate) // Assuming input is cents for simplicity, or dollars * 100
        });
        settingsApi.listZoneRates(Number(selectedTier)).then(setRates);
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Card</InputLabel>
                    <Select value={selectedCard} label="Card" onChange={e => setSelectedCard(e.target.value as number)}>
                        {cards.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Tier</InputLabel>
                    <Select value={selectedTier} label="Tier" onChange={e => setSelectedTier(e.target.value as number)}>
                        {tiers.map(t => <MenuItem key={t.id} value={t.id}>{t.min_oz} - {t.max_oz} oz</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            {selectedTier && (
                <Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField label="Zone" size="small" type="number" value={zone} onChange={e => setZone(e.target.value)} />
                        <TextField label="Rate (Cents)" size="small" type="number" value={rate} onChange={e => setRate(e.target.value)} />
                        <Button variant="contained" onClick={saveRate}>Set Rate</Button>
                    </Box>
                    <TableContainer component={Paper}>
                        <Table size="small">
                            <TableHead><TableRow><TableCell>Zone</TableCell><TableCell>Rate (Cents)</TableCell></TableRow></TableHead>
                            <TableBody>
                                {rates.sort((a, b) => a.zone - b.zone).map(r => <TableRow key={r.id}><TableCell>{r.zone}</TableCell><TableCell>{r.rate_cents}</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}
        </Box>
    );
};

const MarketplaceProfilesTab = () => {
    const [profiles, setProfiles] = useState<MarketplaceShippingProfile[]>([]);
    const [marketplaces, setMarketplaces] = useState<EnumValue[]>([]);
    const [cards, setCards] = useState<ShippingRateCard[]>([]);

    const [selectedMp, setSelectedMp] = useState("DEFAULT");
    const [selectedCard, setSelectedCard] = useState<number | ''>('');
    const [pricingZone, setPricingZone] = useState<number>(7);

    const load = async () => {
        const [p, m, c] = await Promise.all([settingsApi.listProfiles(), enumsApi.marketplaces(), settingsApi.listRateCards()]);
        setProfiles(p);
        setMarketplaces([{ value: "DEFAULT", name: "Default" }, ...m]);
        setCards(c);
    };
    useEffect(() => { load(); }, []);

    const assign = async () => {
        if (!selectedCard) return;
        await settingsApi.assignProfile({
            marketplace: selectedMp,
            rate_card_id: Number(selectedCard),
            pricing_zone: pricingZone
        });
        load();
        alert("Profile assigned");
    };

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Marketplace</InputLabel>
                            <Select value={selectedMp} label="Marketplace" onChange={e => setSelectedMp(e.target.value)}>
                                {marketplaces.map(m => <MenuItem key={m.value} value={m.value}>{m.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Rate Card</InputLabel>
                            <Select value={selectedCard} label="Rate Card" onChange={e => setSelectedCard(e.target.value as number)}>
                                {cards.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={3}>
                        <TextField
                            label="Pricing Zone" size="small" type="number" fullWidth
                            value={pricingZone} onChange={e => setPricingZone(parseInt(e.target.value))}
                        />
                    </Grid>
                    <Grid item xs={3}>
                        <Button variant="contained" fullWidth onClick={assign}>Assign Profile</Button>
                    </Grid>
                </Grid>
            </Paper>

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead><TableRow><TableCell>Marketplace</TableCell><TableCell>Card</TableCell><TableCell>Zone</TableCell><TableCell>Effective</TableCell></TableRow></TableHead>
                    <TableBody>
                        {profiles.map(p => {
                            const cardName = cards.find(c => c.id === p.rate_card_id)?.name || p.rate_card_id;
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>{p.marketplace}</TableCell>
                                    <TableCell>{cardName}</TableCell>
                                    <TableCell>{p.pricing_zone}</TableCell>
                                    <TableCell>{new Date(p.effective_date).toLocaleDateString()}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
